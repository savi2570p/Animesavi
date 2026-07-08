// Live upload speed/bytes tracker — pub-sub so any UI panel can read
// the current upload throughput without prop drilling through the file
// upload hook.

export interface UploadSpeedSnapshot {
  bytesPerSecond: number; // measured throughput (rolling window)
  bytesUploaded: number;
  bytesTotal: number;
  isActive: boolean;
  startedAt: number; // performance.now() when current upload started
}

type Listener = (snap: UploadSpeedSnapshot) => void;

const state: UploadSpeedSnapshot = {
  bytesPerSecond: 0,
  bytesUploaded: 0,
  bytesTotal: 0,
  isActive: false,
  startedAt: 0,
};

const listeners = new Set<Listener>();

function emit() {
  const snap = { ...state };
  listeners.forEach((l) => l(snap));
}

export function beginUpload(totalBytes: number) {
  state.bytesPerSecond = 0;
  state.bytesUploaded = 0;
  state.bytesTotal = totalBytes;
  state.isActive = true;
  state.startedAt = performance.now();
  emit();
}

export function reportUpload(bytesUploaded: number, bytesPerSecond: number) {
  state.bytesUploaded = bytesUploaded;
  state.bytesPerSecond = bytesPerSecond;
  state.isActive = true;
  emit();
}

export function endUpload() {
  state.isActive = false;
  state.bytesPerSecond = 0;
  emit();
}

export function getUploadSnapshot(): UploadSpeedSnapshot {
  return { ...state };
}

export function subscribeUpload(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}
