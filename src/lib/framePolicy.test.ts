import { describe, expect, it } from 'vitest';
import { isFrameableBy } from '../../supabase/functions/_shared/framePolicy';

const h = (o: Record<string, string>) => new Headers(o);
const ORIGIN = 'https://animesavi.com';

describe('isFrameableBy', () => {
  it('blocks X-Frame-Options SAMEORIGIN (AniChi, Shonen)', () => {
    expect(isFrameableBy(h({ 'x-frame-options': 'SAMEORIGIN' }), ORIGIN)).toBe(false);
  });

  it("blocks frame-ancestors 'self' (Re-Anime)", () => {
    expect(
      isFrameableBy(h({ 'content-security-policy': "frame-ancestors 'self'; object-src 'none'" }), ORIGIN),
    ).toBe(false);
  });

  it('allows sites with no framing headers', () => {
    expect(isFrameableBy(h({}), ORIGIN)).toBe(true);
  });

  it('allows frame-ancestors that list AnimeSavi', () => {
    expect(
      isFrameableBy(h({ 'content-security-policy': 'frame-ancestors https://animesavi.com' }), ORIGIN),
    ).toBe(true);
  });
});
