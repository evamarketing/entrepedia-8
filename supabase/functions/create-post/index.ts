import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_id, content, image_url, youtube_url, business_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (!userProfile || userError) {
      // Create profile if it doesn't exist
      const { error: createProfileError } = await supabase
        .from("profiles")
        .upsert({ id: user_id }, { onConflict: 'id' });
      
      if (createProfileError) {
        console.error("Profile creation error:", createProfileError);
        return new Response(
          JSON.stringify({ error: "Please complete your profile setup first" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If business_id is provided, verify ownership
    if (business_id) {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("id, owner_id")
        .eq("id", business_id)
        .maybeSingle();

      if (businessError || !businessData) {
        return new Response(
          JSON.stringify({ error: "Business not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (businessData.owner_id !== user_id) {
        return new Response(
          JSON.stringify({ error: "You don't have permission to post for this business" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate content
    if (!content && !image_url && !youtube_url) {
      return new Response(
        JSON.stringify({ error: "Post must have content, image, or video" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        user_id,
        content: content || null,
        image_url: image_url || null,
        youtube_url: youtube_url || null,
        business_id: business_id || null,
      })
      .select()
      .single();

    if (postError) {
      console.error("Post creation error:", postError);
      return new Response(
        JSON.stringify({ error: "Failed to create post" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, post }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create post error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
