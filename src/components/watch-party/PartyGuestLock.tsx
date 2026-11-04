import { useEffect, useState, type RefObject } from 'react';
import { Crown, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { getWatchPartyPlayback } from '@/lib/watchPartySession';

const BLOCKED_KEYS = new Set([
  ' ', 'Spacebar', 'k', 'K', 'j', 'J', 'l', 'L', 'n', 'N', 'p', 'P', 'f', 'F', 'm', 'M',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ',', '.', '<', '>',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaTrackNext', 'MediaTrackPrevious',
  'MediaFastForward', 'MediaRewind', 'MediaStop',
]);

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const getVideo = () => document.querySelector('video') as HTMLVideoElement | null;

/**
 * Covers the player for joined guests so taps, swipes, double-taps and keyboard
 * shortcuts can't drive shared playback. Only personal sound and fullscreen remain.
 */
export function PartyGuestLock({ containerRef }: { containerRef: RefObject<HTMLElement> }) {
  const [muted, setMuted] = useState(() => getVideo()?.muted ?? false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || !BLOCKED_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    const onVolume = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) setMuted(e.target.muted);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('volumechange', onVolume, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('volumechange', onVolume, true);
    };
  }, []);

  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // A tap only re-joins the host's playback (needed when autoplay was blocked).
  const resync = (e: React.SyntheticEvent) => {
    stop(e);
    const v = getVideo();
    const state = getWatchPartyPlayback();
    if (v && state?.playing && v.paused) v.play().catch(() => {});
  };

  const toggleSound = (e: React.MouseEvent) => {
    stop(e);
    const v = getVideo();
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    setMuted(v.muted);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    stop(e);
    const el = containerRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      // iPhone Safari only supports native video fullscreen; host sync still reverts changes.
      (getVideo() as any)?.webkitEnterFullscreen?.();
    }
  };

  return (
    <div
      className="party-guest-lock"
      role="presentation"
      onClick={resync}
      onDoubleClick={stop}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={stop}
    >
      <div className="party-guest-lock-bar">
        <span className="party-guest-lock-pill">
          <Crown aria-hidden="true" />
          Host controls playback
        </span>
        <div className="party-guest-lock-actions">
          <button type="button" onClick={toggleSound} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
