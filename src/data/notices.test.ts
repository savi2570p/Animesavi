import { describe, expect, it } from 'vitest';
import { SITE_NOTICES, sortNotices } from './notices';

describe('notice archive order', () => {
  it('shows newest notices first without losing older notices', () => {
    const ordered = sortNotices(SITE_NOTICES, 'newest');
    expect(ordered[0].id).toBe('security-fixes-2026-11-28');
    expect(ordered.map((notice) => notice.id)).toContain('downloads-removed-2026-11-19');
    expect(ordered).toHaveLength(SITE_NOTICES.length);
  });
  it('reverses the full archive for oldest first without mutating it', () => {
    const original = [...SITE_NOTICES];
    expect(sortNotices(SITE_NOTICES, 'oldest')).toEqual(sortNotices(SITE_NOTICES, 'newest').reverse());
    expect(SITE_NOTICES).toEqual(original);
  });
});