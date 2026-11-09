import { describe, expect, it } from 'vitest';
import { recordProgressWrite, shouldWriteProgress } from './watchProgressThrottle';

const tick = (now: number, position: number, completed = false, episodeId = 'ep1') => ({ episodeId, now, position, completed });

describe('watch progress write throttle', () => {
  it('writes the first tick of an episode', () => {
    expect(shouldWriteProgress(null, tick(0, 10))).toBe(true);
  });

  it('skips normal playback ticks within 15 seconds of the last save', () => {
    const prev = recordProgressWrite(tick(0, 10));
    expect(shouldWriteProgress(prev, tick(14_000, 24))).toBe(false);
  });

  it('saves again once 15 seconds have passed', () => {
    const prev = recordProgressWrite(tick(0, 10));
    expect(shouldWriteProgress(prev, tick(15_000, 25))).toBe(true);
  });

  it('saves immediately when the episode becomes completed', () => {
    const prev = recordProgressWrite(tick(0, 1300));
    expect(shouldWriteProgress(prev, tick(1_000, 1301, true))).toBe(true);
  });

  it('saves immediately after a seek of 30 seconds or more', () => {
    const prev = recordProgressWrite(tick(0, 100));
    expect(shouldWriteProgress(prev, tick(1_000, 400))).toBe(true);
  });

  it('saves immediately when switching to another episode', () => {
    const prev = recordProgressWrite(tick(0, 100));
    expect(shouldWriteProgress(prev, tick(1_000, 5, false, 'ep2'))).toBe(true);
  });
});
