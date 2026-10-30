import { expect, it } from 'vitest';
import { effectivePlayerQuality } from './playerQualityPolicy';
it('allows adaptive mobile playback even when the normal quality lock is 4K', () => {
  expect(effectivePlayerQuality(false, true, 2160)).toBeUndefined();
});
it('preserves 1080p Data Saver on mobile', () => {
  expect(effectivePlayerQuality(true, true, 2160)).toBe(1080);
});
it('preserves the desktop quality lock', () => {
  expect(effectivePlayerQuality(false, false, 2160)).toBe(2160);
});