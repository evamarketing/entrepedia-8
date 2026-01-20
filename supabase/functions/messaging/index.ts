import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

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

    // Validate session token
    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Session token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session and get user_id
    const { data: userId, error: sessionError } = await supabase
      .rpc("validate_session", { p_session_token: sessionToken });

    if (sessionError) {
      console.error("validate_session error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session validation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // GET CONVERSATIONS
    if (action === "get_conversations") {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      // Enrich with other user data and last message
      const enrichedConversations = await Promise.all(
        (conversations || []).map(async (conv) => {
          const otherUserId = conv.participant_one === userId
            ? conv.participant_two
            : conv.participant_one;

          if (!otherUserId) return { ...conv, other_user: null };

          const { data: userData } = await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url, is_online")
            .eq("id", otherUserId)
            .single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("is_read", false)
            .neq("sender_id", userId);

          return {
            ...conv,
            other_user: userData,
            last_message: lastMsg?.content,
            unread_count: count || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ conversations: enrichedConversations }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET MESSAGES
    if (action === "get_messages") {
      const { conversation_id } = body;

      // Verify user is participant
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversation_id)
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation_id)
        .neq("sender_id", userId)
        .eq("is_read", false);

      return new Response(
        JSON.stringify({ messages: messages || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEND MESSAGE
    if (action === "send_message") {
      const { conversation_id, content } = body;

      if (!content?.trim()) {
        return new Response(
          JSON.stringify({ error: "Message content required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user is participant
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversation_id)
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert message
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          conversation_id,
          sender_id: userId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversation_id);

      return new Response(
        JSON.stringify({ message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CREATE OR GET CONVERSATION
    if (action === "get_or_create_conversation") {
      const { other_user_id } = body;

      if (!other_user_id) {
        return new Response(
          JSON.stringify({ error: "Other user ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ensure consistent ordering
      const userOne = userId < other_user_id ? userId : other_user_id;
      const userTwo = userId < other_user_id ? other_user_id : userId;

      // Try to find existing conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("participant_one", userOne)
        .eq("participant_two", userTwo)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ conversation_id: existing.id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          participant_one: userOne,
          participant_two: userTwo,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ conversation_id: newConv.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE CONVERSATION
    if (action === "delete_conversation") {
      const { conversation_id } = body;

      // Verify user is participant
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversation_id)
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete all messages first
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversation_id);

      // Delete conversation
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversation_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE MESSAGE
    if (action === "delete_message") {
      const { message_id } = body;

      // Verify user is sender
      const { data: msg } = await supabase
        .from("messages")
        .select("*")
        .eq("id", message_id)
        .eq("sender_id", userId)
        .maybeSingle();

      if (!msg) {
        return new Response(
          JSON.stringify({ error: "Message not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", message_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MARK MESSAGES AS READ
    if (action === "mark_read") {
      const { conversation_id } = body;

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation_id)
        .neq("sender_id", userId)
        .eq("is_read", false);

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
    console.error("Messaging error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
