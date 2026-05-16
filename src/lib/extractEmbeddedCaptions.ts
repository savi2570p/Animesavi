/**
 * Best-effort browser-based extraction of embedded subtitle tracks from a
 * video URL. Works only when the browser exposes the embedded text tracks
 * via HTMLVideoElement.textTracks (typically MP4 with tx3g, HLS with
 * WebVTT sidecars, or MKV in browsers that surface SubRip tracks).
 *
 * Returns a WebVTT string, or null if no extractable captions were found.
 */
export async function extractEmbeddedCaptionsToVTT(
  videoUrl: string,
  opts: { timeoutMs?: number; preferLang?: string } = {}
): Promise<{ vtt: string; trackLabel: string; trackLang: string } | null> {
  const { timeoutMs = 20000, preferLang } = opts;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    document.body.appendChild(video);

    let settled = false;
    const cleanup = () => {
      try { video.pause(); } catch {}
      try { document.body.removeChild(video); } catch {}
    };
    const finish = (result: Awaited<ReturnType<typeof extractEmbeddedCaptionsToVTT>>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    const tryCollect = () => {
      const tracks = Array.from(video.textTracks || []);
      if (!tracks.length) return false;

      // Prefer subtitle/captions tracks, optionally matching preferLang
      const candidates = tracks
        .filter(t => t.kind === 'subtitles' || t.kind === 'captions')
        .sort((a, b) => {
          if (preferLang) {
            const am = (a.language || '').toLowerCase().startsWith(preferLang) ? -1 : 0;
            const bm = (b.language || '').toLowerCase().startsWith(preferLang) ? -1 : 0;
            return am - bm;
          }
          return 0;
        });
      if (!candidates.length) return false;

      const track = candidates[0];
      track.mode = 'hidden';

      const buildVTT = () => {
        const cues = Array.from(track.cues || []) as VTTCue[];
        if (!cues.length) return null;
        const fmt = (t: number) => {
          const h = Math.floor(t / 3600).toString().padStart(2, '0');
          const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
          const s = Math.floor(t % 60).toString().padStart(2, '0');
          const ms = Math.floor((t - Math.floor(t)) * 1000).toString().padStart(3, '0');
          return `${h}:${m}:${s}.${ms}`;
        };
        let out = 'WEBVTT\n\n';
        cues.forEach((c, i) => {
          out += `${i + 1}\n${fmt(c.startTime)} --> ${fmt(c.endTime)}\n${(c as any).text || ''}\n\n`;
        });
        return out;
      };

      // Cues may arrive asynchronously — poll briefly
      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts++;
        const vtt = buildVTT();
        if (vtt) {
          window.clearInterval(poll);
          window.clearTimeout(timer);
          finish({ vtt, trackLabel: track.label || 'Embedded', trackLang: track.language || '' });
        } else if (attempts > 40) { // ~8s
          window.clearInterval(poll);
        }
      }, 200);

      return true;
    };

    video.addEventListener('loadedmetadata', () => {
      if (!tryCollect()) {
        // Some browsers populate tracks on play/seek
        video.currentTime = 0.1;
        video.play().catch(() => {});
        window.setTimeout(() => {
          if (!tryCollect()) {
            // Wait once more — maybe still parsing
            window.setTimeout(() => {
              if (!tryCollect()) finish(null);
            }, 2500);
          }
        }, 500);
      }
    });

    video.addEventListener('error', () => finish(null));
    video.src = videoUrl;
    video.load();
  });
}
