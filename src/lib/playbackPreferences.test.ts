import { describe, it, expect } from 'vitest';
import { selectDataSaverLevel, dataSaverEnabled } from './playbackPreferences';
describe('Data Saver', () => {
  it('selects exactly 1080p instead of 4K when available', () => {
    expect(selectDataSaverLevel([{ height: 2160 }, { height: 1080 }, { height: 720 }])?.height).toBe(1080);
  });
  it('never selects above 1080p when 1080p is unavailable', () => {
    expect(selectDataSaverLevel([{ height: 2160 }, { height: 720 }])?.height).toBe(720);
    expect(selectDataSaverLevel([{ height: 2160 }])).toBeUndefined();
  });
  it('only enables the restriction while the option is on', () => {
    localStorage.setItem('pref_data_saver', '1'); expect(dataSaverEnabled()).toBe(true);
    localStorage.setItem('pref_data_saver', '0'); expect(dataSaverEnabled()).toBe(false);
  });
});