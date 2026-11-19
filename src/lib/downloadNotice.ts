/** The "Downloads removed" notice may appear at most once every 48 hours. */
export const DOWNLOAD_NOTICE_KEY = 'download_removed_notice_last_shown';
export const DOWNLOAD_NOTICE_INTERVAL_MS = 48 * 60 * 60 * 1000;

export function shouldShowDownloadNotice(lastShown: string | null, now = Date.now()): boolean {
  const last = Number(lastShown);
  if (!lastShown || !Number.isFinite(last) || last <= 0) return true;
  if (last > now) return false;
  return now - last >= DOWNLOAD_NOTICE_INTERVAL_MS;
}

export function readDownloadNoticeLastShown(): string | null {
  try { return localStorage.getItem(DOWNLOAD_NOTICE_KEY); } catch { return null; }
}

export function markDownloadNoticeShown(now = Date.now()): void {
  try { localStorage.setItem(DOWNLOAD_NOTICE_KEY, String(now)); } catch { /* ignore */ }
}
