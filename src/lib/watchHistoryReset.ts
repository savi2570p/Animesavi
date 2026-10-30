const RESET_KEY = 'watch_history_reset_generation';
let initialGeneration = localStorage.getItem(RESET_KEY);
export function historyResetSinceLoad() { return localStorage.getItem(RESET_KEY) !== initialGeneration; }
// A newly navigated viewing session may save progress; the old paused session cannot.
export function beginHistorySession() { initialGeneration = localStorage.getItem(RESET_KEY); }
export function markHistoryReset() {
  localStorage.setItem(RESET_KEY, crypto.randomUUID());
  document.querySelectorAll('video').forEach(video => video.pause());
}