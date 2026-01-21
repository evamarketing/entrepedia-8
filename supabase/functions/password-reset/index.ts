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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, mobile_number, date_of_birth, new_password } = await req.json();

    if (action === "verify_identity") {
      // Validate inputs
      if (!mobile_number || !/^[0-9]{10}$/.test(mobile_number)) {
        return new Response(
          JSON.stringify({ error: "Please enter a valid 10-digit mobile number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!date_of_birth) {
        return new Response(
          JSON.stringify({ error: "Date of birth is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Verifying identity for mobile: ${mobile_number}, dob: ${date_of_birth}`);

      // Check if mobile number exists and get the user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, date_of_birth, mobile_number")
        .eq("mobile_number", mobile_number)
        .maybeSingle();

      if (profileError) {
        console.error("Profile lookup error:", profileError);
        return new Response(
          JSON.stringify({ error: "Failed to verify identity" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!profile) {
        console.log("No account found with mobile:", mobile_number);
        return new Response(
          JSON.stringify({ error: "No account found with this mobile number" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if profile has date_of_birth
      if (!profile.date_of_birth) {
        console.log("User does not have date of birth set:", profile.id);
        return new Response(
          JSON.stringify({ error: "Password reset is not available. Please contact support." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compare dates (normalize both to YYYY-MM-DD format)
      const storedDOB = profile.date_of_birth.split('T')[0]; // Handle if it's a datetime
      const providedDOB = date_of_birth.split('T')[0];

      console.log(`Comparing DOB - stored: ${storedDOB}, provided: ${providedDOB}`);

      if (storedDOB !== providedDOB) {
        console.log("DOB mismatch for user:", profile.id);
        return new Response(
          JSON.stringify({ error: "Mobile number and date of birth do not match our records" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Identity verified successfully for user:", profile.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Identity verified successfully",
          verified: true,
          user_id: profile.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    else if (action === "reset_password") {
      if (!mobile_number || !date_of_birth || !new_password) {
        return new Response(
          JSON.stringify({ error: "Mobile number, date of birth, and new password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Resetting password for mobile: ${mobile_number}`);

      // Verify identity again before resetting
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, date_of_birth, mobile_number")
        .eq("mobile_number", mobile_number)
        .maybeSingle();

      if (!profile || !profile.date_of_birth) {
        return new Response(
          JSON.stringify({ error: "Identity verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const storedDOB = profile.date_of_birth.split('T')[0];
      const providedDOB = date_of_birth.split('T')[0];

      if (storedDOB !== providedDOB) {
        return new Response(
          JSON.stringify({ error: "Identity verification failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash new password
      const passwordHash = await hashPassword(new_password);

      // Update password in user_credentials
      const { error: updateError } = await supabase
        .from("user_credentials")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("mobile_number", mobile_number);

      if (updateError) {
        console.error("Password update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidate all sessions for this user
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("user_id", profile.id);

      console.log("Password reset successfully for user:", profile.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password reset successfully. Please sign in with your new password.",
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
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});