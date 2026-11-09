/**
 * Decides when a playback tick should be persisted to the backend.
 *
 * The <video> element fires `timeupdate` about four times per second. Writing
 * every tick turned a single viewer into a steady stream of database writes,
 * so progress is saved on a fixed cadence plus the moments that matter:
 * first tick of an episode, a seek, and reaching "completed". The exact
 * second-level resume point is still kept locally on every tick.
 */
export const PROGRESS_WRITE_INTERVAL_MS = 15_000;
export const PROGRESS_SEEK_JUMP_SECONDS = 30;

export interface ProgressWriteState {
  episodeId: string;
  lastWriteAt: number;
  lastPosition: number;
  lastCompleted: boolean;
}

export interface ProgressTick {
  episodeId: string;
  now: number;
  position: number;
  completed: boolean;
}

export function shouldWriteProgress(prev: ProgressWriteState | null, next: ProgressTick): boolean {
  if (!prev || prev.episodeId !== next.episodeId) return true;
  if (next.completed && !prev.lastCompleted) return true;
  if (Math.abs(next.position - prev.lastPosition) >= PROGRESS_SEEK_JUMP_SECONDS) return true;
  return next.now - prev.lastWriteAt >= PROGRESS_WRITE_INTERVAL_MS;
}

export function recordProgressWrite(next: ProgressTick): ProgressWriteState {
  return {
    episodeId: next.episodeId,
    lastWriteAt: next.now,
    lastPosition: next.position,
    lastCompleted: next.completed,
  };
}
