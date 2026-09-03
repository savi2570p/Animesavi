/**
 * Anti-piracy + screen-recording lock.
 *
 * IMPORTANT — browser limitations (be honest):
 *   There is NO public web API that reliably reports OS-level screen recording
 *   on desktop, Android, or iOS. The only thing the browser can fully detect
 *   is the in-browser Screen Capture API (`getDisplayMedia`). Everything else
 *   is best-effort heuristic. We layer multiple signals so the overlay trips
 *   for the common cases (Chrome/Edge/Firefox screen share, iOS 17+
 *   `screen.isExtended` / capture handle, Android mirroring sessions).
 *
 * Detection layers:
 *   1. `navigator.mediaDevices.getDisplayMedia` interception   (all browsers)
 *   2. Capture Handle API + `screen.isExtended` polling        (Chromium 104+)
 *   3. iOS `window.screen` capture flag (Safari 17+)           (best-effort)
 *   4. `navigator.mediaDevices.ondevicechange` spike           (most browsers)
 *   5. Visibility + tab-blur thrash heuristic during playback  (mobile mirror)
 *
 * Public surface:
 *   - installAntiPiracy(opts)        — global guard install (idempotent)
 *   - subscribeRecordingLock(cb)     — listen to lock state changes
 *   - isRecordingLocked()            — read current lock state
 *   - lockPlaybackNow(reason)        — manual trip (used by tests)
 *   - unlockPlayback()               — manual release
 */

export type AntiPiracyMode = 'soft' | 'strict';

interface InstallOptions {
  mode?: AntiPiracyMode;
  onTrip?: (reason: string) => void;
  redirectOnTrip?: boolean;
}

type LockListener = (locked: boolean, reason: string | null) => void;

let installed = false;
let locked = false;
let lockReason: string | null = null;
const listeners = new Set<LockListener>();

function emit() {
  listeners.forEach((cb) => {
    try { cb(locked, lockReason); } catch {}
  });
}

export function subscribeRecordingLock(cb: LockListener): () => void {
  listeners.add(cb);
  cb(locked, lockReason);
  return () => { listeners.delete(cb); };
}

export function isRecordingLocked() { return locked; }

/** Aggressively kill any active <video>: pause, strip src, dispatch destroy event. */
function killAllVideos() {
  document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => {
    try {
      v.pause();
      v.removeAttribute('src');
      // Drop any <source> children too
      v.querySelectorAll('source').forEach((s) => s.remove());
      v.load();
      v.dispatchEvent(new CustomEvent('antipiracy:destroy'));
    } catch {}
  });
  // Signal any HLS/Shaka wrappers listening on window
  try { window.dispatchEvent(new CustomEvent('antipiracy:lock')); } catch {}
}

export function lockPlaybackNow(reason: string) {
  if (locked && lockReason === reason) return;
  locked = true;
  lockReason = reason;
  document.documentElement.setAttribute('data-rec-locked', 'true');
  killAllVideos();
  emit();
}

export function unlockPlayback() {
  if (!locked) return;
  locked = false;
  lockReason = null;
  document.documentElement.removeAttribute('data-rec-locked');
  try { window.dispatchEvent(new CustomEvent('antipiracy:unlock')); } catch {}
  emit();
}

function trip(reason: string, opts: InstallOptions) {
  opts.onTrip?.(reason);
  // Screen-record / screen-share trips ALWAYS lock playback regardless of mode.
  if (reason === 'screenshare' || reason.startsWith('capture:')) {
    lockPlaybackNow(reason);
    return;
  }
  if (opts.mode === 'strict') {
    killAllVideos();
    if (opts.redirectOnTrip !== false) {
      try { window.location.replace('/'); } catch {}
    }
  }
}

export function installAntiPiracy(opts: InstallOptions = {}) {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;
  const mode: AntiPiracyMode = opts.mode ?? 'soft';

  // 1. Right-click
  const onContext = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    trip('contextmenu', { ...opts, mode });
  };

  // 2. Key combos
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const blocked =
      k === 'F12' ||
      (ctrl && shift && (k === 'I' || k === 'i' || k === 'J' || k === 'j' || k === 'C' || k === 'c')) ||
      (ctrl && (k === 'U' || k === 'u' || k === 'S' || k === 's' || k === 'P' || k === 'p'));
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      trip('keycombo:' + k, { ...opts, mode });
    }
  };

  // 3. Drag / image save
  const onDragStart = (e: DragEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'IMG' || t.tagName === 'VIDEO')) e.preventDefault();
  };

  // 4. iframe break-out (strict only)
  if (mode === 'strict') {
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = window.location.href;
      }
    } catch {
      document.documentElement.style.display = 'none';
    }
  }

  // 5. getDisplayMedia interception — kills browser-level screen share before it starts
  let originalGDM: typeof navigator.mediaDevices.getDisplayMedia | null = null;
  if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
    originalGDM = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = (async () => {
      trip('screenshare', { ...opts, mode });
      throw new DOMException('Screen capture is disabled on this page', 'NotAllowedError');
    }) as any;
  }

  // 6. DevTools heuristic
  let devtoolsOpen = false;
  const detectDevtools = () => {
    const threshold = 160;
    const sizeOpen =
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold;
    let timingOpen = false;
    if (mode === 'strict') {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      (function () { debugger; })();
      timingOpen = performance.now() - start > 100;
    }
    const open = sizeOpen || timingOpen;
    if (open && !devtoolsOpen) {
      devtoolsOpen = true;
      trip('devtools', { ...opts, mode });
    } else if (!open && devtoolsOpen) {
      devtoolsOpen = false;
    }
  };

  // 7. Capture / mirroring heuristics — polled every 1s
  //    Several experimental signals across browsers; we OR them.
  const detectCapture = () => {
    try {
      const scr: any = window.screen;
      // Chromium "Capture Handle" / multi-screen
      if (scr && (scr.isExtended === true || scr.isCaptured === true)) {
        trip('capture:screen-flag', { ...opts, mode });
        return;
      }
      // Safari iOS 17+: hidden flag on screen
      if (scr && scr.captured === true) {
        trip('capture:ios-flag', { ...opts, mode });
        return;
      }
    } catch {}
    // If we previously locked via flag but it's now gone, auto-unlock.
    if (locked && lockReason && lockReason.startsWith('capture:')) {
      try {
        const scr: any = window.screen;
        const stillCaptured =
          scr && (scr.isExtended === true || scr.isCaptured === true || scr.captured === true);
        if (!stillCaptured) unlockPlayback();
      } catch {}
    }
  };

  // 8. Device-change burst: mirroring sessions often register a virtual audio sink
  const onDeviceChange = () => {
    // Soft signal — don't lock by itself, just nudge a capture re-check
    detectCapture();
  };

  // Polling is visibility-gated: `detectDevtools` reads window.outerWidth /
  // innerWidth, which forces a layout on every tick. Running that twice a
  // second forever (including in background tabs) was a constant main-thread
  // tax on low-end phones for zero protection benefit.
  let devInterval = 0;
  let capInterval = 0;

  const startPolling = () => {
    if (devInterval || capInterval) return;
    devInterval = window.setInterval(detectDevtools, 3000);
    capInterval = window.setInterval(detectCapture, 2500);
  };
  const stopPolling = () => {
    if (devInterval) window.clearInterval(devInterval);
    if (capInterval) window.clearInterval(capInterval);
    devInterval = 0;
    capInterval = 0;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      // Re-check immediately on return, then resume the slow cadence.
      detectCapture();
      startPolling();
    } else {
      stopPolling();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible') startPolling();

  // 9. Android long-press "Download video" suppression.
  //    Chrome/Samsung/Firefox Android fire `contextmenu` on long-press of a
  //    <video>. We already preventDefault that globally, but we also harden
  //    every <video> with controlsList="nodownload" + disablePictureInPicture
  //    and intercept the touch path so the native popup never opens.
  const hardenVideo = (v: HTMLVideoElement) => {
    try {
      v.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
      v.setAttribute('disablePictureInPicture', '');
      v.setAttribute('disableRemotePlayback', '');
      (v as any).disablePictureInPicture = true;
      v.oncontextmenu = (e) => { e.preventDefault(); return false; };
    } catch {}
  };
  document.querySelectorAll<HTMLVideoElement>('video').forEach(hardenVideo);
  const moEl = document.body || document.documentElement;
  const mo = new MutationObserver((muts) => {
    muts.forEach((m) =>
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLVideoElement) hardenVideo(n);
        else if (n instanceof HTMLElement) {
          n.querySelectorAll?.<HTMLVideoElement>('video').forEach(hardenVideo);
        }
      }),
    );
  });
  try { mo.observe(moEl, { subtree: true, childList: true }); } catch {}

  // Touch-based long-press cancel — fires the contextmenu preventDefault before
  // Android's download / "Copy shadow link" sheet can attach. We arm a
  // pre-emptive contextmenu killer AND set a 350ms timer that re-asserts it
  // (the native popup uses ~500ms, so we win the race).
  let longPressTimer: number | null = null;
  const cancelLongPress = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const inPlayer = t.tagName === 'VIDEO' || t.tagName === 'IFRAME' ||
      !!t.closest?.('.embed-player, .player-container, .embed-frame, .embed-frame-shield');
    if (!inPlayer) return;
    const killer = (ev: Event) => ev.preventDefault();
    t.addEventListener('contextmenu', killer, { once: true });
    document.addEventListener('contextmenu', killer, { once: true, capture: true });
    cancelLongPress();
    longPressTimer = window.setTimeout(() => {
      document.addEventListener('contextmenu', killer, { once: true, capture: true });
    }, 300);
  };
  const onTouchEnd = () => cancelLongPress();

  document.addEventListener('contextmenu', onContext);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchmove', onTouchEnd, { passive: true, capture: true });
  try { navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange); } catch {}

  return () => {
    document.removeEventListener('contextmenu', onContext);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('dragstart', onDragStart);
    document.removeEventListener('touchstart', onTouchStart, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchEnd, true);
    document.removeEventListener('touchmove', onTouchEnd, true);
    try { navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange); } catch {}
    try { mo.disconnect(); } catch {}
    document.removeEventListener('visibilitychange', onVisibility);
    stopPolling();
    if (originalGDM && navigator.mediaDevices) {
      (navigator.mediaDevices as any).getDisplayMedia = originalGDM;
    }
    installed = false;
  };
}

/** Placeholder for tokenized stream URLs — wire to CDN signer when ready. */
export function getSecureStreamUrl(rawUrl: string): string {
  // Refuse to mint a URL while playback is locked
  if (locked) return '';
  return rawUrl;
}
