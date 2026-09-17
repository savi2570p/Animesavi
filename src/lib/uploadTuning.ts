// Real upload tuning store.
//
// This replaces the old "Boost Speed" simulation. Nothing here fabricates
// throughput or progress — it only selects legitimate transfer parameters
// (chunk size) that the upload transport actually uses. TUS slices the File
// lazily, so the complete video is never loaded into browser memory.
//
// Lovable Cloud resumable (TUS) storage currently requires every PATCH chunk
// to be exactly 6 MB. Larger multiples may be accepted when the upload is
// created but are rejected on the first PATCH, which looks like an upload
// failing at 1–5%. Keep this centralized so no upload surface can regress.

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

/** Return the exact chunk size required by resumable storage. */
export function pickChunkSize(_fileSize: number, _maxUnits = 1): number {
  return CHUNK_UNIT;
}

