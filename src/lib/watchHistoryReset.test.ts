import { it, expect } from 'vitest';
import { markHistoryReset, historyResetSinceLoad } from './watchHistoryReset';
it('blocks stale playback sessions after an account-wide history reset', () => {
  expect(historyResetSinceLoad()).toBe(false);
  markHistoryReset();
  expect(historyResetSinceLoad()).toBe(true);
});