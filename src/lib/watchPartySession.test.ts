import { describe, it, expect } from 'vitest';
import { isGuestLocked, shouldSkipWatchHistory, expectedPartyTime, partyEpisodePath } from './watchPartySession';

const host = { partyId: 'p', code: 'ABC123', isHost: true };
const guest = { partyId: 'p', code: 'ABC123', isHost: false };

describe('watch party rules', () => {
  it('locks controls for joined guests only, never the room owner', () => {
    expect(isGuestLocked(guest)).toBe(true);
    expect(isGuestLocked(host)).toBe(false);
    expect(isGuestLocked(null)).toBe(false);
  });

  it('skips Continue Watching for every party member', () => {
    expect(shouldSkipWatchHistory(host, '')).toBe(true);
    expect(shouldSkipWatchHistory(guest, '')).toBe(true);
  });

  it('skips Continue Watching while a party link is still connecting', () => {
    expect(shouldSkipWatchHistory(null, '?party=ABC123')).toBe(true);
  });

  it('saves Continue Watching normally outside a party', () => {
    expect(shouldSkipWatchHistory(null, '?t=40')).toBe(false);
  });

  it('extrapolates the host position while playing', () => {
    expect(expectedPartyTime({ time: 10, playing: true, at: 1000 }, 4000)).toBe(13);
    expect(expectedPartyTime({ time: 10, playing: false, at: 1000 }, 4000)).toBe(10);
  });

  it('keeps the party code when the host changes episode', () => {
    expect(partyEpisodePath('e2', host)).toBe('/watch/e2?party=ABC123');
    expect(partyEpisodePath('e2', null)).toBe('/watch/e2');
  });
});
