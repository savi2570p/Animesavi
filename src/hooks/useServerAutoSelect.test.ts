import { describe, it, expect, beforeEach } from 'vitest';
import { getServerGroups, getPlaybackEngine, getDefaultServer, getServerVideoUrl, SERVER_CONFIGS } from './useServerAutoSelect';

const names = (ids: string[]) => ids.map(id => SERVER_CONFIGS[id as keyof typeof SERVER_CONFIGS].name);

describe('player server groups', () => {
  it('DUB anime get H.Savi and AS+ under DUB, and 4K+ under SUB', () => {
    const g = getServerGroups(false);
    expect(names(g.dub)).toEqual(['H.Savi', 'AS+']);
    expect(names(g.sub)).toEqual(['4K+']);
  });

  it('SUB-only anime get only the 4K+ SUB server', () => {
    const g = getServerGroups(true);
    expect(g.dub).toEqual([]);
    expect(names(g.sub)).toEqual(['4K+']);
  });

  it('SUB plays through the AS+ engine', () => {
    expect(getPlaybackEngine('SUB')).toBe('XPLUS');
    expect(getPlaybackEngine('PLAY')).toBe('PLAY');
  });
});

describe('saved server default', () => {
  beforeEach(() => localStorage.clear());
  it('never restores SUB or Multi.Savi as the default', () => {
    localStorage.setItem('preferred_video_server', 'SUB');
    expect(getDefaultServer()).toBe('XPLUS');
    localStorage.setItem('preferred_video_server', 'Zex');
    expect(getDefaultServer()).toBe('XPLUS');
    localStorage.setItem('preferred_video_server', 'PLAY');
    expect(getDefaultServer()).toBe('PLAY');
  });
});

describe('SUB episode file', () => {
  it('4K+ plays the added SUB file', () => {
    expect(getServerVideoUrl('SUB', 'dub.mp4', 'sub.mp4')).toBe('sub.mp4');
  });
  it('4K+ falls back to the main file when no SUB file was added', () => {
    expect(getServerVideoUrl('SUB', 'dub.mp4', null)).toBe('dub.mp4');
    expect(getServerVideoUrl('SUB', 'dub.mp4', '  ')).toBe('dub.mp4');
  });
  it('DUB servers never play the SUB file', () => {
    expect(getServerVideoUrl('PLAY', 'dub.mp4', 'sub.mp4')).toBe('dub.mp4');
    expect(getServerVideoUrl('XPLUS', 'dub.mp4', 'sub.mp4')).toBe('dub.mp4');
  });
});
