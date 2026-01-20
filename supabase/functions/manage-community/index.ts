import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
};

Deno.serve(async (req) => {
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

    // Validate session token
    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "No session token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userId, error: sessionError } = await supabase
      .rpc("validate_session", { p_session_token: sessionToken });

    if (sessionError || !userId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, community_id, name, description, cover_image_url } = await req.json();

    // CREATE community
    if (action === "create") {
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: "Community name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the community
      const { data: community, error: createError } = await supabase
        .from("communities")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          cover_image_url: cover_image_url || null,
          created_by: userId,
        })
        .select()
        .single();

      if (createError) {
        console.error("Create community error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Auto-join creator as admin
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          user_id: userId,
          role: "admin",
        });

      if (memberError) {
        console.error("Add member error:", memberError);
      }

      return new Response(
        JSON.stringify({ success: true, community }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE community
    if (action === "update") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .single();

      if (!existingCommunity || existingCommunity.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to update this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("communities")
        .update({
          name: name?.trim(),
          description: description?.trim() || null,
          cover_image_url: cover_image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", community_id);

      if (updateError) {
        console.error("Update community error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE community
    if (action === "delete") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .single();

      if (!existingCommunity || existingCommunity.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to delete this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabase
        .from("communities")
        .delete()
        .eq("id", community_id);

      if (deleteError) {
        console.error("Delete community error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // JOIN community
    if (action === "join") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: joinError } = await supabase
        .from("community_members")
        .insert({
          community_id,
          user_id: userId,
          role: "member",
        });

      if (joinError) {
        console.error("Join community error:", joinError);
        return new Response(
          JSON.stringify({ error: joinError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEAVE community
    if (action === "leave") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: leaveError } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community_id)
        .eq("user_id", userId);

      if (leaveError) {
        console.error("Leave community error:", leaveError);
        return new Response(
          JSON.stringify({ error: leaveError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
