/**
 * Custom embed token system.
 *
 * Public URL format (per product requirement):
 *   https://animesavi.cloudsavi/<TOKEN>
 *
 * Tokens are opaque, unpredictable, 8-char base62 strings generated server-side
 * and stored in `video_embeds`. They always contain at least one uppercase
 * character, which is how the root router tells them apart from clone slugs.
 */

import { supabase } from '@/integrations/supabase/client';

export const EMBED_PUBLIC_ORIGIN = 'https://animesavi.cloudsavi';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const RESOLVER_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/embed-resolve`;

export type EmbedStatus = 'READY' | 'PROCESSING' | 'FAILED' | 'DISABLED' | 'NOT_FOUND';

export interface EmbedSource {
  url: string;
  type: 'hls' | 'mp4' | 'other';
  label: string;
}

export interface EmbedResolution {
  status: EmbedStatus;
  reason?: string;
  token?: string;
  title?: string;
  animeTitle?: string | null;
  episodeNumber?: number;
  seasonNumber?: number | null;
  poster?: string | null;
  duration?: number | null;
  captions?: string | null;
  progress?: number | null;
  stage?: string | null;
  source?: EmbedSource;
  sources?: EmbedSource[];
}

/** Public, shareable embed URL (the branded custom domain). */
export function buildPublicEmbedUrl(token: string): string {
  return `${EMBED_PUBLIC_ORIGIN}/${token}`;
}

/** Same token path on whatever origin the app is currently served from —
 *  used for "Open Embed" so the link always works, even before the custom
 *  domain finishes pointing at this app. */
export function buildLocalEmbedUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : EMBED_PUBLIC_ORIGIN;
  return `${origin}/${token}`;
}

/** Does this root path segment look like an embed token (vs. a clone slug)? */
export function isEmbedTokenCandidate(value: string | undefined | null): boolean {
  return !!value && /^(?=.*[A-Z])[A-Za-z0-9]{6,12}$/.test(value);
}

/** Resolve a token to playable metadata through the secure backend resolver. */
export async function resolveEmbedToken(token: string, signal?: AbortSignal): Promise<EmbedResolution> {
  try {
    const res = await fetch(`${RESOLVER_BASE}/${encodeURIComponent(token)}`, { signal });
    const data = (await res.json()) as EmbedResolution;
    return data ?? { status: 'FAILED', reason: 'Empty resolver response.' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return { status: 'FAILED', reason: 'Network error while resolving this embed.' };
  }
}

/** Look up the active public token for an episode (works for signed-out viewers). */
export async function lookupEmbedTokenForEpisode(episodeId: string): Promise<string | null> {
  try {
    const res = await fetch(`${RESOLVER_BASE}?episodeId=${encodeURIComponent(episodeId)}`);
    const data = await res.json();
    return typeof data?.token === 'string' ? data.token : null;
  } catch {
    return null;
  }
}

type ManageAction = 'ensure' | 'generate' | 'regenerate' | 'disable' | 'test' | 'status';

export interface ManageResult {
  token?: string;
  url?: string;
  status?: EmbedStatus;
  created?: boolean;
  verified?: boolean;
  exists?: boolean;
  disabled?: boolean;
  ok?: boolean;
  checks?: { step: string; ok: boolean; detail?: string }[];
  error?: string;
}

/** Admin/uploader embed management (create, rotate, disable, health check). */
export async function manageEmbed(action: ManageAction, episodeId: string): Promise<ManageResult> {
  const { data, error } = await supabase.functions.invoke('embed-manage', {
    body: { action, episodeId },
  });
  if (error) {
    const ctxBody = (error as { context?: { body?: unknown } }).context?.body;
    let message = error.message;
    if (typeof ctxBody === 'string') {
      try { message = JSON.parse(ctxBody)?.error ?? message; } catch { /* keep */ }
    }
    return { error: message, ...(data ?? {}) };
  }
  return (data ?? {}) as ManageResult;
}

/**
 * Fire-and-forget auto embed creation after a successful upload/save.
 * Never throws — the upload flow must not fail because of embed generation.
 */
export async function autoEnsureEmbed(episodeId: string): Promise<ManageResult | null> {
  try {
    const status = await manageEmbed('status', episodeId);
    if (status.exists) return manageEmbed('ensure', episodeId);
    return await manageEmbed('generate', episodeId);
  } catch {
    return null;
  }
}
