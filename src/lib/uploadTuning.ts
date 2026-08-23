// Real upload tuning store.
//
// This replaces the old "Boost Speed" simulation. Nothing here fabricates
// throughput or progress — it only selects legitimate transfer parameters
// (chunk size) that the upload transport actually uses.
//
// Lovable Cloud resumable (TUS) storage requires chunk sizes that are
// multiples of 6 MB, and does NOT support the concatenation extension, so
// true parallel part uploads are not available. The one real lever we have
// on throughput is chunk size: bigger chunks = fewer round trips = more of
// the pipe used on high-bandwidth links.

const MB = 1024 * 1024;
export const CHUNK_UNIT = 6 * MB; // storage-mandated multiple

type Listener = (state: TuningState) => void;

export interface TuningState {
  turbo: boolean;
}

const state: TuningState = { turbo: true };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l({ ...state }));
}

export function setTurbo(next: boolean) {
  if (state.turbo === next) return;
  state.turbo = next;
  emit();
}

export function isTurbo(): boolean {
  return state.turbo;
}

export function getTuningState(): TuningState {
  return { ...state };
}

export function subscribeTuning(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Pick a real chunk size (multiple of 6 MB) from the file size and the
 * browser's reported link speed. Larger chunks reduce per-request overhead
 * on fast links; small files stay on small chunks so progress stays granular.
 */
export function pickChunkSize(fileSize: number): number {
  const units = (() => {
    if (fileSize <= 60 * MB) return 1; // 6 MB
    if (fileSize <= 400 * MB) return 2; // 12 MB
    if (fileSize <= 2 * 1024 * MB) return 4; // 24 MB
    return 6; // 36 MB
  })();

  let scaled = units;

  // Fast links benefit from fewer, larger round trips.
  const downlink = (navigator as Navigator & { connection?: { downlink?: number } })
    .connection?.downlink;
  if (typeof downlink === 'number' && downlink >= 50) scaled = Math.min(scaled * 2, 8);

  if (state.turbo) scaled = Math.min(scaled * 2, 8); // cap 48 MB

  return Math.max(1, scaled) * CHUNK_UNIT;
}
