import { describe, expect, it, vi } from 'vitest';
import { fileFingerprint, isRetryableUploadStatus, retryDelay } from '@/lib/resumableUpload';

describe('resumable upload helpers', () => {
  it('keeps .mkv.mp4 names distinct and stable', () => {
    const file = { name: 'Anime S03E12 Hindi-Eng-Jap.mkv.mp4', size: 2_100_000_000, lastModified: 123 };
    const first = fileFingerprint(file, 'anime-videos', 'anime/id/episodes/file.mkv.mp4');
    const second = fileFingerprint(file, 'anime-videos', 'anime/id/episodes/file.mkv.mp4');
    expect(first).toBe(second);
    expect(first).toContain('.mkv.mp4');
  });

  it.each([0, 401, 408, 409, 423, 429, 500, 502, 503, 504])('retries transient HTTP status %i', (status) => {
    expect(isRetryableUploadStatus(status)).toBe(true);
  });

  it.each([400, 403, 404, 413, 422])('does not loop on permanent HTTP status %i', (status) => {
    expect(isRetryableUploadStatus(status)).toBe(false);
  });

  it('uses exponential retry delays with bounded jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 15_000]);
    vi.restoreAllMocks();
  });
});