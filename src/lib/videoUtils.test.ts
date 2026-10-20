import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHLSConfig } from './videoUtils';

afterEach(() => vi.restoreAllMocks());
describe('shared server streaming budget', () => {
  it('keeps 4K available without speculative fragment downloads', () => {
    const config = getHLSConfig();
    expect(config.capLevelToPlayerSize).toBe(false);
    expect(config.startFragPrefetch).toBe(false);
    expect(config.progressive).toBe(false);
  });
  it('buffers a bounded cushion on Android instead of a whole episode', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android');
    const config = getHLSConfig();
    expect(config.maxBufferLength).toBe(12);
    expect(config.maxMaxBufferLength).toBe(24);
    expect(config.backBufferLength).toBe(6);
  });
  it('limits ahead data on save-data connections while preserving renditions', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone');
    vi.spyOn(navigator, 'connection', 'get').mockReturnValue({ saveData: true } as never);
    const config = getHLSConfig();
    expect(config.maxBufferLength).toBe(8);
    expect(config.maxBufferSize).toBe(16_000_000);
    expect(config.capLevelToPlayerSize).toBe(false);
  });
});