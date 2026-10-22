import { describe, it, expect, vi } from 'vitest';
import { readDownloadSize } from './downloadMetadata';

describe('download preparation', () => {
  it('continues without a size when the host never responds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    try {
      const result = readDownloadSize('https://example.test/movie.mp4', new AbortController().signal);
      await vi.advanceTimersByTimeAsync(6000);
      expect(await result).toBeNull();
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });
  it('cancels the response body when a size probe ignores byte ranges', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, headers: new Headers() })
      .mockResolvedValueOnce({ status: 200, headers: new Headers(), body: { cancel } }));
    try {
      expect(await readDownloadSize('https://example.test/movie.mp4', new AbortController().signal)).toBeNull();
      expect(cancel).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});