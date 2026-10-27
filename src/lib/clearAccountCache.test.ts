import { it, expect, vi } from 'vitest';
import { clearImageData } from './clearAccountCache';
it('clears images and resume checkpoints without deleting offline videos or sign-in', async () => {
  localStorage.clear(); localStorage.setItem('resume:episode', '120'); localStorage.setItem('account-session', 'keep');
  const remove = vi.fn().mockResolvedValue(true);
  await clearImageData(localStorage, { keys: async () => ['images-cache', 'gcp-images-cache', 'offline-videos', 'workbox-precache'], delete: remove } as unknown as CacheStorage);
  expect(remove.mock.calls.map(call => call[0])).toEqual(['images-cache', 'gcp-images-cache']);
  expect(localStorage.getItem('resume:episode')).toBeNull(); expect(localStorage.getItem('account-session')).toBe('keep');
});