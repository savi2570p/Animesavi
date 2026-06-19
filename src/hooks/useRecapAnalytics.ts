import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Logs AI recap opens + completion rate.
 * Returns { trackOpen, trackComplete }.
 *  - trackOpen() inserts a new event and remembers its id.
 *  - trackComplete(durationSeconds) flips the same event to completed.
 */
export function useRecapAnalytics(opts: {
  episodeId?: string | null;
  watchPartyId?: string | null;
  context?: 'episode' | 'watch_party';
}) {
  const eventIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const trackOpen = useCallback(async () => {
    if (!opts.episodeId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      startedAtRef.current = Date.now();
      const { data, error } = await supabase
        .from('recap_analytics')
        .insert({
          episode_id: opts.episodeId,
          user_id: userId,
          watch_party_id: opts.watchPartyId ?? null,
          context: opts.context ?? 'episode',
        })
        .select('id')
        .single();
      if (!error && data) eventIdRef.current = data.id;
    } catch (e) {
      console.warn('[recap-analytics] open failed', e);
    }
  }, [opts.episodeId, opts.watchPartyId, opts.context]);

  const trackComplete = useCallback(async () => {
    if (!eventIdRef.current) return;
    try {
      const seconds = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0;
      await supabase
        .from('recap_analytics')
        .update({ completed: true, duration_seconds: seconds })
        .eq('id', eventIdRef.current);
    } catch (e) {
      console.warn('[recap-analytics] complete failed', e);
    }
  }, []);

  const trackProgress = useCallback(async (seconds: number) => {
    if (!eventIdRef.current) return;
    try {
      await supabase
        .from('recap_analytics')
        .update({ duration_seconds: Math.max(0, Math.round(seconds)) })
        .eq('id', eventIdRef.current);
    } catch { /* ignore */ }
  }, []);

  return { trackOpen, trackComplete, trackProgress };
}
