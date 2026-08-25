import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const uid = user.id;

    // Every table that references the user, in dependency-safe order.
    // Child rows (likes/replies/messages) are removed before their parents so
    // no foreign key can block the final auth user deletion.
    const deletes: Array<[string, string]> = [
      ["comment_likes", "user_id"],
      ["comment_reports", "reporter_id"],
      ["comment_notifications", "user_id"],
      ["comment_notifications", "replier_id"],
      ["comments", "user_id"],
      ["shorts_likes", "user_id"],
      ["shorts_comments", "user_id"],
      ["shorts", "uploader_id"],
      ["watch_party_messages", "user_id"],
      ["watch_party_members", "user_id"],
      ["watch_parties", "host_id"],
      ["shared_collection_likes", "user_id"],
      ["shared_collections", "user_id"],
      ["shadow_flix_continue_watching", "user_id"],
      ["shadow_flix_player_preferences", "user_id"],
      ["recap_analytics", "user_id"],
      ["watch_history", "user_id"],
      ["watch_later", "user_id"],
      ["user_favorites", "user_id"],
      ["user_genre_preferences", "user_id"],
      ["anime_reviews", "user_id"],
      ["notification_queue", "user_id"],
      ["push_subscriptions", "user_id"],
      ["sent_push_log", "user_id"],
      ["token_usage", "user_id"],
      ["admin_token_grants", "user_id"],
      ["admin_token_grants", "granted_by"],
      ["uploader_applications", "user_id"],
      ["user_bans", "user_id"],
      ["user_roles", "user_id"],
      ["profiles", "id"],
    ];

    // Tables where the row must survive but must no longer point at the user.
    const detach: Array<[string, string]> = [
      ["anime", "uploader_id"],
      ["unlock_tokens", "created_by"],
      ["upload_codes", "used_by"],
      ["flox_content", "uploaded_by"],
      ["shadow_flix_content", "uploaded_by"],
    ];

    const failures: string[] = [];

    for (const [table, column] of deletes) {
      try {
        const { error } = await admin.from(table).delete().eq(column, uid);
        // Missing table / missing column in this environment is not fatal.
        if (error && !/does not exist|schema cache/i.test(error.message)) {
          failures.push(`${table}.${column}: ${error.message}`);
        }
      } catch (e) {
        failures.push(`${table}.${column}: ${(e as Error).message}`);
      }
    }

    for (const [table, column] of detach) {
      try {
        const { error } = await admin.from(table).update({ [column]: null }).eq(column, uid);
        if (error && !/does not exist|schema cache/i.test(error.message)) {
          failures.push(`${table}.${column}: ${error.message}`);
        }
      } catch (e) {
        failures.push(`${table}.${column}: ${(e as Error).message}`);
      }
    }

    if (failures.length > 0) {
      console.error(JSON.stringify({ operation: "delete-account", user_id: uid, failures }));
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "DATABASE_ERROR", message: "Account data could not be fully removed. Nothing was deleted." },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) {
      console.error(JSON.stringify({ operation: "delete-account", user_id: uid, error: error.message }));
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "INTERNAL_ERROR", message: `Account could not be deleted: ${error.message}` },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-account fatal", (err as Error).message);
    return new Response(JSON.stringify({ success: false, error: { message: (err as Error).message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
