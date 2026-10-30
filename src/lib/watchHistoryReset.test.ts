import { it, expect } from 'vitest';
import { beginHistorySession, markHistoryReset, historyResetSinceLoad } from './watchHistoryReset';
it('blocks stale playback sessions after an account-wide history reset', () => {
  expect(historyResetSinceLoad()).toBe(false);
  markHistoryReset();
  expect(historyResetSinceLoad()).toBe(true);
});
it('allows new viewing sessions after cleanup without reloading the catalogue', () => {
  markHistoryReset();
  expect(historyResetSinceLoad()).toBe(true);
  beginHistorySession();
  expect(historyResetSinceLoad()).toBe(false);
});