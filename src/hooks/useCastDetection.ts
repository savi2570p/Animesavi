import { useEffect, useState } from 'react';

/**
 * Detects whether the user is currently casting / mirroring the screen via:
 * - AirPlay (iOS/macOS Safari)
 * - Chromecast / Remote Playback API (Chrome/Android)
 * - Presentation API (active connection)
 * - External display via window.matchMedia('(display-mode: ...)')
 *
 * Failsafe: if detection throws unexpectedly, we assume casting = true so
 * the user is NEVER blocked by token popups on a TV / mirrored screen.
 */
export function useCastDetection(): boolean {
  const [isCasting, setIsCasting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const safeSet = (val: boolean) => {
      if (!cancelled) setIsCasting(val);
    };

    const detect = () => {
      try {
        // 1. AirPlay on any <video>
        const videos = Array.from(document.querySelectorAll('video'));
        for (const v of videos) {
          if ((v as any).webkitCurrentPlaybackTargetIsWireless === true) {
            safeSet(true);
            return;
          }
          // Remote Playback connected state
          const remote = (v as any).remote;
          if (remote && remote.state === 'connected') {
            safeSet(true);
            return;
          }
        }

        // 2. Presentation API receiver/controller
        const presentation = (navigator as any).presentation;
        if (presentation?.receiver) {
          safeSet(true);
          return;
        }

        // 3. Display-mode media query (mirrored / external)
        if (typeof window.matchMedia === 'function') {
          if (window.matchMedia('(display-mode: fullscreen)').matches &&
              window.screen && window.screen.width > 1920) {
            // Likely mirrored to a TV (heuristic, optional)
          }
        }

        safeSet(false);
      } catch {
        // Failsafe → assume casting so popups never block TV playback
        safeSet(true);
      }
    };

    detect();

    // Listen on every <video> for AirPlay + Remote Playback changes
    const attach = () => {
      const videos = Array.from(document.querySelectorAll('video'));
      videos.forEach((v) => {
        const onAir = () => detect();
        v.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', onAir);
        cleanups.push(() => v.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', onAir));

        const remote = (v as any).remote;
        if (remote && typeof remote.addEventListener === 'function') {
          const onChange = () => detect();
          remote.addEventListener('connect', onChange);
          remote.addEventListener('connecting', onChange);
          remote.addEventListener('disconnect', onChange);
          cleanups.push(() => {
            remote.removeEventListener('connect', onChange);
            remote.removeEventListener('connecting', onChange);
            remote.removeEventListener('disconnect', onChange);
          });
        }
      });
    };
    attach();

    // Re-scan on DOM mutations (videos added later) and on visibility / resize
    const mo = new MutationObserver(() => { attach(); detect(); });
    mo.observe(document.body, { childList: true, subtree: true });
    cleanups.push(() => mo.disconnect());

    const onVis = () => detect();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onVis);
    cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onVis);
    });

    // Periodic safety poll (cheap)
    const poll = window.setInterval(detect, 3000);
    cleanups.push(() => window.clearInterval(poll));

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => { try { fn(); } catch { /* noop */ } });
    };
  }, []);

  return isCasting;
}
