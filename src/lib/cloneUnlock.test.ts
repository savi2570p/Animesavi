import { describe, it, expect, beforeEach } from 'vitest';
import {
  issueUnlockToken,
  verifyUnlockToken,
  hasActiveUnlock,
  clearUnlock,
  slugify,
  validateCloneForm,
  UNLOCK_DURATION_MS,
} from './cloneUnlock';

describe('clone slug validation', () => {
  it('slugifies names', () => {
    expect(slugify('  Hi Anime World! ')).toBe('hi-anime-world');
  });

  it('flags empty names and slugs', () => {
    const r = validateCloneForm({ name: '  ', slug: '', existingSlugs: [] });
    expect(r.nameError).toBeTruthy();
    expect(r.slugError).toBeTruthy();
    expect(r.valid).toBe(false);
  });

  it('rejects duplicate slugs (case/format insensitive)', () => {
    const r = validateCloneForm({
      name: 'Hi Anime',
      slug: 'Hi Anime',
      existingSlugs: ['hi-anime'],
    });
    expect(r.effectiveSlug).toBe('hi-anime');
    expect(r.slugError).toMatch(/already used/i);
    expect(r.valid).toBe(false);
  });

  it('accepts a unique slug derived from the name', () => {
    const r = validateCloneForm({
      name: 'Gogo Anime',
      slug: '',
      existingSlugs: ['hi-anime'],
    });
    expect(r).toMatchObject({ effectiveSlug: 'gogo-anime', valid: true });
  });
});

describe('ad-to-unlock flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts locked', () => {
    expect(hasActiveUnlock()).toBe(false);
  });

  it('unlocks instantly after the ad issues a token', () => {
    const token = issueUnlockToken();
    expect(verifyUnlockToken(token)).toBe(true);
    expect(hasActiveUnlock()).toBe(true);
  });

  it('rejects a forged / mismatched token (handshake guard)', () => {
    issueUnlockToken();
    expect(verifyUnlockToken(`forged.${Date.now() + 10_000}`)).toBe(false);
  });

  it('expires after the unlock window', () => {
    const now = Date.now();
    const token = issueUnlockToken(now);
    expect(verifyUnlockToken(token, now + UNLOCK_DURATION_MS + 1)).toBe(false);
  });

  it('clears the unlock', () => {
    issueUnlockToken();
    clearUnlock();
    expect(hasActiveUnlock()).toBe(false);
  });
});
