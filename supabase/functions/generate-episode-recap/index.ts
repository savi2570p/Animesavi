// Generate a ~30 second AI recap for an episode and store it on the row.
// Triggered automatically when an uploader publishes an episode, and callable
// on demand for backfill / regeneration.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  episode_id: string;
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    if (!body?.episode_id) {
      return new Response(
        JSON.stringify({ error: "episode_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull episode + season + anime context
    const { data: ep, error: epErr } = await supabase
      .from("episodes")
      .select(
        "id, title, episode_number, description, ai_recap, season_id, seasons:season_id (season_number, anime_id, anime:anime_id (title, description, genres))",
      )
      .eq("id", body.episode_id)
      .maybeSingle();

    if (epErr || !ep) {
      return new Response(
        JSON.stringify({ error: epErr?.message ?? "Episode not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (ep.ai_recap && !body.force) {
      return new Response(
        JSON.stringify({ ok: true, recap: ep.ai_recap, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // deno-lint-ignore no-explicit-any
    const season: any = Array.isArray(ep.seasons) ? ep.seasons[0] : ep.seasons;
    // deno-lint-ignore no-explicit-any
    const anime: any = season ? (Array.isArray(season.anime) ? season.anime[0] : season.anime) : null;

    const animeTitle = anime?.title ?? "this anime";
    const synopsis = (anime?.description ?? "").slice(0, 1200);
    const genres: string[] = anime?.genres ?? [];
    const seasonNum = season?.season_number ?? 1;
    const epNum = ep.episode_number ?? 1;
    const epTitle = ep.title ?? `Episode ${epNum}`;

    const prompt = `Write a "Previously on" style 30-second recap (about 70-90 words, spoken aloud at a calm narrator pace) that catches a returning viewer up before they watch ${animeTitle}, Season ${seasonNum}, Episode ${epNum}: "${epTitle}".

Series synopsis: ${synopsis || "(unavailable)"}
Genres: ${genres.join(", ") || "(unavailable)"}

Constraints:
- Do NOT spoil this episode (Episode ${epNum}). Only recap the world, characters, stakes, and momentum heading into it.
- Open with a hook ("Previously…", "On ${animeTitle}…", or similar).
- One paragraph, no headings, no bullet points, no episode title prefix.
- Plain text only.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write short, punchy anime recaps in the voice of a Netflix-style narrator." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: "AI gateway error", status: aiRes.status, detail: errText }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const recap: string = aiJson?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!recap) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: upErr } = await supabase
      .from("episodes")
      .update({ ai_recap: recap, ai_recap_generated_at: new Date().toISOString() })
      .eq("id", body.episode_id);

    if (upErr) {
      return new Response(
        JSON.stringify({ error: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, recap }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
