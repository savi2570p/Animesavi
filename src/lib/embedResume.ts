import { safeStorage } from '@/lib/storage/safeStorage';

export function readEmbedResume(episodeId: string, duration: number, explicitTime?: number): number {
  const time = explicitTime ?? Number(safeStorage.getItem(`resume:${episodeId}`));
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration <= 0) return 0;
  // A completed episode should open from the beginning, not its final frame.
  if (explicitTime === undefined && time >= duration - 5) return 0;
  return Math.min(time, Math.max(0, duration - 1));
}

export function saveEmbedResume(episodeId: string, time: number, duration: number, ended = false) {
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration <= 0) return;
  if (ended || time >= duration - 5) safeStorage.removeItem(`resume:${episodeId}`);
  else safeStorage.setItem(`resume:${episodeId}`, String(time));
}