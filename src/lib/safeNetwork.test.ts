import { describe, expect, it } from 'vitest';
import { isPublicIp } from '../../supabase/functions/_shared/safeNetwork';

describe('outbound media network guard', () => {
  it('blocks loopback, private, and cloud-metadata addresses', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('10.0.0.8')).toBe(false);
    expect(isPublicIp('169.254.169.254')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
  });

  it('allows ordinary public IP addresses', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true);
    expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
  });
});
