import { describe, expect, it } from 'vitest';
import { canSeeShadowLinks } from './shadowLinkAccess';

describe('Shadow link sharing visibility', () => {
  it('allows shadowflixxorg@gmail.com to see both sharing options', () => {
    expect(canSeeShadowLinks('shadowflixxorg@gmail.com')).toBe(true);
    expect(canSeeShadowLinks('SHADOWFLIXXORG@gmail.com')).toBe(true);
  });
  it('preserves existing sharing access', () => {
    expect(canSeeShadowLinks('savi2570p@gmail.com')).toBe(true);
    expect(canSeeShadowLinks('shadowtoonsindia@gmail.com')).toBe(true);
  });
  it('does not show restricted sharing options to other or signed-out accounts', () => {
    expect(canSeeShadowLinks('other@gmail.com')).toBe(false);
    expect(canSeeShadowLinks(null)).toBe(false);
    expect(canSeeShadowLinks()).toBe(false);
  });
});