import { it, expect, vi } from 'vitest';
import { clearImageData } from './clearAccountCache';
it('clears images and resume checkpoints without deleting offline videos or sign-in', async () => {
  localStorage.clear(); localStorage.setItem('resume:episode', '120'); localStorage.setItem('account-session', 'keep');
  localStorage.setItem('favorites', '["anime-1"]'); localStorage.setItem('offline-downloads', '["episode-1"]');
  const remove = vi.fn().mockResolvedValue(true);
  await clearImageData(localStorage, { keys: async () => ['images-cache', 'gcp-images-cache', 'anime-catalog-cache', 'episodes-cache', 'seasons-cache', 'offline-videos', 'workbox-precache'], delete: remove } as unknown as CacheStorage);
  expect(remove.mock.calls.map(call => call[0])).toEqual(['images-cache', 'gcp-images-cache']);
  expect(localStorage.getItem('resume:episode')).toBeNull(); expect(localStorage.getItem('account-session')).toBe('keep');
});
it('preserves favorites during image and resume cleanup', async () => {
  localStorage.setItem('favorites', '["anime-1"]');
  await clearImageData(localStorage);
  expect(localStorage.getItem('favorites')).toBe('["anime-1"]');
});
it('preserves offline download metadata during cleanup', async () => {
  localStorage.setItem('offline-downloads', '["episode-1"]');
  await clearImageData(localStorage);
  expect(localStorage.getItem('offline-downloads')).toBe('["episode-1"]');
});