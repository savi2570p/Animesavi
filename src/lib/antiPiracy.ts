/**
 * Anti-piracy hardening utilities.
 *
 * LIMITATION: Browsers cannot reliably detect OS-level screen recording on
 * desktop/iOS/Android. The realistic protections implemented here are:
 *   - Right-click → pause player + redirect home (strict mode)
 *   - DevTools detection via window-size delta + debugger timing trap
 *   - getDisplayMedia() interception (browser-level screen-share only)
 *   - Key-combo blockers for the most common save/inspect shortcuts
 *   - CSS/JS suppression of selection, drag, long-press, image save
 *   - iframe break-out
 *
 * True signed/tokenized HLS playback requires a CDN + backend signer and is
 * NOT implemented here. Hook your CDN signer into `getSecureStreamUrl()` when ready.
 */

export type AntiPiracyMode = 'soft' | 'strict';

interface InstallOptions {
  mode?: AntiPiracyMode;
  onTrip?: (reason: string) => void;
  /** When true, right-click and devtools trips pause any <video> + redirect to "/". */
  redirectOnTrip?: boolean;
}

let installed = false;

function pauseAllVideos() {
  document.querySelectorAll('video').forEach((v) => {
    try {
      v.pause();
      // Clear src so the buffered URL can't be sniffed from network inspector replay.
      v.removeAttribute('src');
      v.load();
    } catch {}
  });
}

function trip(reason: string, opts: InstallOptions) {
  opts.onTrip?.(reason);
  if (opts.mode === 'strict') {
    pauseAllVideos();
    if (opts.redirectOnTrip !== false) {
      try {
        window.location.replace('/');
      } catch {}
    }
  }
}

export function installAntiPiracy(opts: InstallOptions = {}) {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;
  const mode: AntiPiracyMode = opts.mode ?? 'soft';

  // 1. Right-click
  const onContext = (e: MouseEvent) => {
    // allow inputs/textarea for UX
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

  // 4. iframe break-out (strict mode only)
  if (mode === 'strict') {
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = window.location.href;
      }
    } catch {
      // cross-origin top — at least blank our page
      document.documentElement.style.display = 'none';
    }
  }

  // 5. getDisplayMedia interception (browser screen-share)
  let originalGDM: typeof navigator.mediaDevices.getDisplayMedia | null = null;
  if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
    originalGDM = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = (async (...args: any[]) => {
      trip('screenshare', { ...opts, mode });
      throw new DOMException('Screen capture is disabled on this page', 'NotAllowedError');
    }) as any;
  }

  // 6. DevTools detection — runs every 1.5s
  let devtoolsOpen = false;
  const detectDevtools = () => {
    const threshold = 160;
    const widthDelta = window.outerWidth - window.innerWidth;
    const heightDelta = window.outerHeight - window.innerHeight;
    const sizeOpen = widthDelta > threshold || heightDelta > threshold;

    // Timing-based debugger trap — if devtools is open, the `debugger`
    // statement pauses execution making this block measurably slow.
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
  const devInterval = window.setInterval(detectDevtools, 1500);

  document.addEventListener('contextmenu', onContext);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('dragstart', onDragStart);

  return () => {
    document.removeEventListener('contextmenu', onContext);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('dragstart', onDragStart);
    window.clearInterval(devInterval);
    if (originalGDM && navigator.mediaDevices) {
      // restore
      (navigator.mediaDevices as any).getDisplayMedia = originalGDM;
    }
    installed = false;
  };
}

/**
 * Placeholder for tokenized stream URLs.
 *
 * Plug this into your CDN signer (Cloudflare Stream signed URLs, AWS CloudFront
 * signed cookies, etc.). Until then, returns the URL unchanged.
 */
export function getSecureStreamUrl(rawUrl: string): string {
  return rawUrl;
}
