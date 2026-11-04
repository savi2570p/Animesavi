import { expect, it } from 'vitest';
import { effectivePlayerQuality } from './playerQualityPolicy';
it('uses the 4K lock on mobile when Data Saver is off', () => {
  expect(effectivePlayerQuality(false, true, 2160)).toBe(2160);
});
it('preserves 1080p Data Saver on mobile', () => {
  expect(effectivePlayerQuality(true, true, 2160)).toBe(1080);
});
it('preserves the desktop quality lock', () => {
  expect(effectivePlayerQuality(false, false, 2160)).toBe(2160);
});
