import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate a simple session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required env vars", { hasUrl: !!supabaseUrl, hasServiceRole: !!supabaseServiceKey });
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, mobile_number, password, full_name } = await req.json();

    if (!mobile_number || !password) {
      return new Response(
        JSON.stringify({ error: "Mobile number and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "signup") {
      if (!full_name) {
        return new Response(
          JSON.stringify({ error: "Full name is required for signup" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if mobile number already exists
      const { data: existingUser } = await supabase
        .from("user_credentials")
        .select("id")
        .eq("mobile_number", mobile_number)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "This mobile number is already registered" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password and create user credentials
      const passwordHash = await hashPassword(password);
      
      const { data: credentials, error: credError } = await supabase
        .from("user_credentials")
        .insert({
          mobile_number,
          password_hash: passwordHash,
        })
        .select()
        .single();

      if (credError) {
        console.error("Credential creation error:", credError);
        return new Response(
          JSON.stringify({ error: "Failed to create account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: credentials.id,
          full_name,
          mobile_number,
          username: mobile_number,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Rollback credentials if profile creation fails
        await supabase.from("user_credentials").delete().eq("id", credentials.id);
        return new Response(
          JSON.stringify({ error: "Failed to create profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate session token and store in database
      const sessionToken = generateSessionToken();
      
      const { error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          user_id: credentials.id,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        });

       if (sessionError) {
         console.error("Session creation error:", sessionError);
         return new Response(
           JSON.stringify({ error: "Failed to create session" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: credentials.id,
            mobile_number,
            full_name,
          },
          session_token: sessionToken,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    else if (action === "signin") {
      // Get user credentials
      const { data: credentials, error: credError } = await supabase
        .from("user_credentials")
        .select("*")
        .eq("mobile_number", mobile_number)
        .maybeSingle();

      if (!credentials || credError) {
        return new Response(
          JSON.stringify({ error: "Invalid mobile number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify password
      const isValid = await verifyPassword(password, credentials.password_hash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid mobile number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", credentials.id)
        .single();

      // Generate session token and store in database
      const sessionToken = generateSessionToken();
      
      // Invalidate old sessions for this user
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("user_id", credentials.id);

      // Create new session
      const { error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          user_id: credentials.id,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        });

       if (sessionError) {
         console.error("Session creation error:", sessionError);
         return new Response(
           JSON.stringify({ error: "Failed to create session" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }

      // Update online status
      await supabase
        .from("profiles")
        .update({ is_online: true })
        .eq("id", credentials.id);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: credentials.id,
            mobile_number,
            full_name: profile?.full_name,
            ...profile,
          },
          session_token: sessionToken,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } 
    
    else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Auth error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
