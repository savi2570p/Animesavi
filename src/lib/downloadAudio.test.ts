import { describe, it, expect, vi } from 'vitest';
import { pauseForDownload, discoverDownloadAudio } from './downloadAudio';

describe('download confirmation', () => {
  it('pauses playback when download confirmation opens', () => {
    const pause = vi.fn();
    pauseForDownload({ pause });
    expect(pause).toHaveBeenCalledOnce();
  });
  it('does not download a whole file if byte ranges are unsupported', async () => {
    const cancel = vi.fn();
    const arrayBuffer = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, body: { cancel }, arrayBuffer }));
    try {
      expect(await discoverDownloadAudio('https://example.test/movie.mp4', new AbortController().signal)).toEqual([]);
      expect(arrayBuffer).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});