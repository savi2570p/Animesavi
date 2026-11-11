import { describe, it, expect, beforeEach } from 'vitest';
import { getServerGroups, getPlaybackEngine, getDefaultServer, SERVER_CONFIGS } from './useServerAutoSelect';

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
