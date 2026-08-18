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

    // Cleanup of user-owned rows before removing the auth user.
    // NOTE: the previous version targeted "favorites" and "notifications",
    // which do not exist in this schema — those deletes always failed silently
    // and left orphaned rows behind.
    const uid = user.id;
    const cleanups: Array<[string, PromiseLike<{ error: unknown }>]> = [
      ["watch_history", admin.from("watch_history").delete().eq("user_id", uid)],
      ["watch_later", admin.from("watch_later").delete().eq("user_id", uid)],
      ["user_favorites", admin.from("user_favorites").delete().eq("user_id", uid)],
      ["notification_queue", admin.from("notification_queue").delete().eq("user_id", uid)],
      ["push_subscriptions", admin.from("push_subscriptions").delete().eq("user_id", uid)],
      ["user_genre_preferences", admin.from("user_genre_preferences").delete().eq("user_id", uid)],
      ["comment_notifications", admin.from("comment_notifications").delete().eq("user_id", uid)],
      ["anime_reviews", admin.from("anime_reviews").delete().eq("user_id", uid)],
      ["shared_collections", admin.from("shared_collections").delete().eq("user_id", uid)],
      ["user_roles", admin.from("user_roles").delete().eq("user_id", uid)],
      ["profiles", admin.from("profiles").delete().eq("id", uid)],
    ];

    const failedCleanups: string[] = [];
    for (const [table, op] of cleanups) {
      try {
        const { error } = await op;
        if (error) failedCleanups.push(table);
      } catch {
        failedCleanups.push(table);
      }
    }

    if (failedCleanups.length > 0) {
      // Do NOT delete the auth user when its data could not be cleaned up —
      // that would leave permanently orphaned rows with no owner.
      console.error(JSON.stringify({ operation: "delete-account", user_id: uid, failed: failedCleanups }));
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
        JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Account could not be deleted." } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
