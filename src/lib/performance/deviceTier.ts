/**
 * Device performance tiering.
 *
 * Conservative, privacy-safe capability detection — nothing is stored or sent
 * anywhere except a single localStorage key holding the resolved tier string.
 *
 * The resolved tier is mirrored onto <html> as `perf-high` / `perf-medium` /
 * `perf-low` so CSS can degrade expensive effects (backdrop-filter, blur
 * layers, decorative infinite animations) without touching component code.
 */

export type PerfTier = 'high' | 'medium' | 'low';

const STORAGE_KEY = 'perf_tier_v1';
const CLASS_NAMES: Record<PerfTier, string> = {
  high: 'perf-high',
  medium: 'perf-medium',
  low: 'perf-low',
};

let currentTier: PerfTier = 'high';
let initialised = false;
const listeners = new Set<(tier: PerfTier) => void>();

function readNav() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  return {
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    effectiveType: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData === true,
  };
}

/** Pure capability heuristic — no measurement, safe to run during boot. */
export function detectTier(): PerfTier {
  if (typeof window === 'undefined') return 'high';

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMobile = isAndroid || isIOS;
  const { memory, cores, effectiveType, saveData } = readNav();

  // Explicit user signals always win.
  if (saveData) return 'low';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && isMobile) return 'low';

  // Hard low-end signals.
  if (memory !== undefined && memory <= 2) return 'low';
  if (cores !== undefined && cores <= 2 && isMobile) return 'low';
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'low';
  // Very old Android WebView/Chrome builds.
  const androidVersion = /Android (\d+)/i.exec(ua);
  if (androidVersion && Number(androidVersion[1]) <= 8) return 'low';

  if (isMobile) {
    if (memory !== undefined && memory <= 4) return 'medium';
    if (cores !== undefined && cores <= 4) return 'medium';
    if (effectiveType === '3g') return 'medium';
    // Unknown mobile hardware (Safari exposes neither memory nor a useful
    // core count) — assume "normal phone", not "desktop".
    return 'medium';
  }

  if (memory !== undefined && memory <= 4) return 'medium';
  if (cores !== undefined && cores <= 2) return 'medium';
  return 'high';
}

function applyClass(tier: PerfTier) {
  const root = document.documentElement;
  Object.values(CLASS_NAMES).forEach((c) => root.classList.remove(c));
  root.classList.add(CLASS_NAMES[tier]);
  root.dataset.perfTier = tier;
}

function setTier(tier: PerfTier, persist = true) {
  if (tier === currentTier && initialised) return;
  currentTier = tier;
  applyClass(tier);
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      /* storage disabled — tier still applies for this session */
    }
  }
  listeners.forEach((l) => l(tier));
}

/**
 * One short frame-timing sample (~1.5s, requested once per session) that can
 * demote a device that *claims* to be capable but actually drops frames.
 * It never upgrades a tier, and it stops as soon as it has an answer.
 */
function sampleFrameRate() {
  if (currentTier === 'low') return;
  let frames = 0;
  let raf = 0;
  const start = performance.now();

  const tick = () => {
    frames += 1;
    const elapsed = performance.now() - start;
    if (elapsed < 1500) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const fps = (frames / elapsed) * 1000;
    // Deliberately conservative: a single unlucky sample must not permanently
    // strip effects from a capable device, so we only react to clearly bad
    // frame rates.
    if (fps < 24) setTier('low');
    else if (fps < 45 && currentTier === 'high') setTier('medium');
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  // Never measure a backgrounded tab — rAF is throttled there and would give
  // a false "low-end" reading.
  document.addEventListener('visibilitychange', stop, { once: true });
  raf = requestAnimationFrame(tick);
}

/** Call once, as early as possible. Idempotent. */
export function initPerfTier(): PerfTier {
  if (initialised) return currentTier;
  initialised = true;

  let tier = detectTier();
  try {
    const cached = localStorage.getItem(STORAGE_KEY) as PerfTier | null;
    // A previously *measured* demotion sticks; we never silently re-promote a
    // device that already proved it stutters.
    if (cached === 'low') tier = 'low';
    else if (cached === 'medium' && tier === 'high') tier = 'medium';
  } catch {
    /* ignore */
  }

  setTier(tier, false);
  applyClass(tier);

  if (tier !== 'low' && document.visibilityState === 'visible') {
    // Measure well after first paint so boot work does not skew the sample.
    setTimeout(sampleFrameRate, 6000);
  }
  return tier;
}

export function getPerfTier(): PerfTier {
  return currentTier;
}

export function isLowPerf(): boolean {
  return currentTier === 'low';
}

/** True on medium and low — i.e. "do not run decorative continuous effects". */
export function prefersLightEffects(): boolean {
  return currentTier !== 'high';
}

export function subscribePerfTier(listener: (tier: PerfTier) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
