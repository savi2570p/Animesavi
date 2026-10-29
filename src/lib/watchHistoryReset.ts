const RESET_KEY = 'watch_history_reset_generation';
const initialGeneration = localStorage.getItem(RESET_KEY);
export function historyResetSinceLoad() { return localStorage.getItem(RESET_KEY) !== initialGeneration; }
export function markHistoryReset() {
  localStorage.setItem(RESET_KEY, crypto.randomUUID());
  document.querySelectorAll('video').forEach(video => video.pause());
}