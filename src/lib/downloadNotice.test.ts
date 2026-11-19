import { describe, expect, it } from 'vitest';
import { DOWNLOAD_NOTICE_INTERVAL_MS, shouldShowDownloadNotice } from './downloadNotice';

const HOUR = 60 * 60 * 1000;
const now = 1_800_000_000_000;

describe('download notice 48-hour interval', () => {
  it('uses a 48 hour interval', () => {
    expect(DOWNLOAD_NOTICE_INTERVAL_MS).toBe(48 * HOUR);
  });
  it('shows when never shown before', () => {
    expect(shouldShowDownloadNotice(null, now)).toBe(true);
  });
  it('stays hidden 47 hours after it was shown', () => {
    expect(shouldShowDownloadNotice(String(now - 47 * HOUR), now)).toBe(false);
  });
  it('shows again once 48 hours have passed', () => {
    expect(shouldShowDownloadNotice(String(now - 48 * HOUR), now)).toBe(true);
  });
});
