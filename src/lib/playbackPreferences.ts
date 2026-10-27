import { useSyncExternalStore } from 'react';

export const PREFERENCES_EVENT = 'playback-preferences-changed';
export function dataSaverEnabled() { return localStorage.getItem('pref_data_saver') === '1'; }
export function useDataSaver() {
  return useSyncExternalStore((notify) => {
    window.addEventListener(PREFERENCES_EVENT, notify);
    window.addEventListener('storage', notify);
    return () => { window.removeEventListener(PREFERENCES_EVENT, notify); window.removeEventListener('storage', notify); };
  }, dataSaverEnabled, () => false);
}
export function selectDataSaverLevel<T extends { height: number }>(levels: T[]): T | undefined {
  return levels.find(level => level.height === 1080) ?? [...levels].filter(level => level.height <= 1080).sort((a, b) => b.height - a.height)[0];
}