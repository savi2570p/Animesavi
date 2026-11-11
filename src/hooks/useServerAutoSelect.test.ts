import { describe, it, expect, beforeEach } from 'vitest';
import { getServerGroups, getPlaybackEngine, getDefaultServer, getServerVideoUrl, getEpisodeAudioMarks, filterEpisodesForServer, SERVER_CONFIGS } from './useServerAutoSelect';

const names = (ids: string[]) => ids.map(id => SERVER_CONFIGS[id as keyof typeof SERVER_CONFIGS].name);

describe('player server groups', () => {
  it('DUB episode with a SUB video gets H.Savi and AS+ under DUB, and 4K+ under SUB', () => {
    const g = getServerGroups(false, true);
    expect(names(g.dub)).toEqual(['H.Savi', 'AS+']);
    expect(names(g.sub)).toEqual(['4K+']);
  });

  it('DUB episode without a SUB video has no SUB server', () => {
    const g = getServerGroups(false, false);
    expect(names(g.dub)).toEqual(['H.Savi', 'AS+']);
    expect(g.sub).toEqual([]);
  });

  it('SUB-only anime get only the 4K+ SUB server', () => {
    const g = getServerGroups(true, false);
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

describe('episode audio marks', () => {
  it('DUB episode with a SUB video shows H-DUB and SUB', () => {
    expect(getEpisodeAudioMarks({}, { sub_video_url: 'sub.mp4' })).toEqual(['H-DUB', 'SUB']);
  });
  it('DUB-only episode shows just H-DUB', () => {
    expect(getEpisodeAudioMarks({}, { sub_video_url: null })).toEqual(['H-DUB']);
  });
  it('SUB-only anime shows just SUB', () => {
    expect(getEpisodeAudioMarks({ isSubOnly: true }, {})).toEqual(['SUB']);
  });
});

describe('episodes listed per server', () => {
  const eps = [{ id: '1', sub_video_url: 'a.mp4' }, { id: '2', sub_video_url: null }];
  it('SUB server on a DUB anime lists only episodes with a SUB video', () => {
    expect(filterEpisodesForServer(eps, 'SUB', false).map(e => e.id)).toEqual(['1']);
  });
  it('DUB servers list every episode', () => {
    expect(filterEpisodesForServer(eps, 'PLAY', false).map(e => e.id)).toEqual(['1', '2']);
  });
  it('SUB-only anime list every episode on SUB', () => {
    expect(filterEpisodesForServer(eps, 'SUB', true).map(e => e.id)).toEqual(['1', '2']);
  });
});
