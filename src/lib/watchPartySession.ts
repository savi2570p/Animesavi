import { useSyncExternalStore } from 'react';

/**
 * Shared, presentation-independent watch-party session state.
 * WatchParty publishes membership here; the Watch page reads it to lock guest
 * controls and to keep party viewing out of Continue Watching.
 */
export interface WatchPartySession {
  partyId: string;
  code: string;
  isHost: boolean;
}

export interface WatchPartyPlayback {
  time: number;
  playing: boolean;
  /** Date.now() when this state was received */
  at: number;
}

let session: WatchPartySession | null = null;
let playback: WatchPartyPlayback | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setWatchPartySession(next: WatchPartySession | null) {
  const same =
    session === next ||
    (!!session && !!next && session.partyId === next.partyId && session.code === next.code && session.isHost === next.isHost);
  if (same) return;
  session = next;
  if (!next) playback = null;
  emit();
}

export function getWatchPartySession() {
  return session;
}

export function setWatchPartyPlayback(next: WatchPartyPlayback | null) {
  playback = next;
}

export function getWatchPartyPlayback() {
  return playback;
}

/** Expected host position right now, extrapolated while playing. */
export function expectedPartyTime(state: WatchPartyPlayback, now = Date.now()) {
  return state.playing ? state.time + Math.max(0, now - state.at) / 1000 : state.time;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatchPartySession() {
  return useSyncExternalStore(subscribe, getWatchPartySession, getWatchPartySession);
}

/** Only a joined guest (not the room owner) is locked out of playback controls. */
export function isGuestLocked(s: WatchPartySession | null) {
  return !!s && !s.isHost;
}

/**
 * Party viewing never writes Continue Watching history, for host and guests.
 * A `?party=` link counts as party viewing while membership is still resolving.
 */
export function shouldSkipWatchHistory(s: WatchPartySession | null, search: string) {
  if (s) return true;
  return !!new URLSearchParams(search).get('party');
}

export function partyEpisodePath(episodeId: string, s: WatchPartySession | null) {
  return s ? `/watch/${episodeId}?party=${s.code}` : `/watch/${episodeId}`;
}
