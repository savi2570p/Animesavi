import { describe, it, expect } from 'vitest';
import { getPreferredAudioTrack, getContentAudioLabel, getAudioTrackLabel } from './audioLanguageUtils';

describe('SUB audio on desktop and Android', () => {
  it('shows Japanese when a SUB source has no browser track metadata', () => {
    expect(getContentAudioLabel(true, 'hindi')).toBe('🇯🇵 Japanese');
  });
  it('selects real Japanese instead of a saved Hindi preference for SUB', () => {
    expect(getPreferredAudioTrack([{ label: 'Hindi', lang: 'hin', index: 0 }, { label: 'Japanese', lang: 'jpn', index: 1 }], 'Anime', 'hi', true)).toBe(1);
  });
  it('does not rename a known English stream as Japanese', () => {
    expect(getAudioTrackLabel('English', 'eng', 0)).toBe('🇬🇧 English');
  });
});