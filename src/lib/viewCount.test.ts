import { describe, expect, it } from 'vitest';
import { getViewCount } from './viewCount';

describe('Trending view count consistency', () => {
  it('preserves the shared Hanaori count over raw database views', () => {
    expect(getViewCount('Hanaori-san Still Wants to Fight in the Next Life', 1)).toBe(3600000);
  });
  it('preserves the shared Trapped in a Dating Sim count', () => {
    expect(getViewCount('Trapped in a Dating Sim: The World of Otome Games Is Tough for Mobs', 0)).toBe(6800000);
  });
  it('uses the established Your Name count across sections', () => {
    expect(getViewCount('Your Name', null)).toBe(9500000);
  });
  it('keeps Wistoria stable instead of showing missing or tiny raw counts', () => {
    const title = 'Wistoria: Wand and Sword';
    const count = getViewCount(title, null);
    expect(count).toBeGreaterThanOrEqual(1000000);
    expect(count).toBe(getViewCount(title, 0));
    expect(count).toBe(getViewCount(title, 12));
  });
});