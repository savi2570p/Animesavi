import { describe, expect, it } from 'vitest';
import { isTypingTarget, resolveEmbedHotkey } from './useEmbedHotkeys';

const k = (key: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
  resolveEmbedHotkey({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('embed player keyboard shortcuts', () => {
  it('Space and K toggle play', () => {
    expect(k(' ')).toEqual({ type: 'toggle-play' });
    expect(k('k')).toEqual({ type: 'toggle-play' });
    expect(k('K', { shiftKey: true })).toEqual({ type: 'toggle-play' });
  });

  it('arrows and J/L seek 10 seconds', () => {
    expect(k('ArrowLeft')).toEqual({ type: 'seek', delta: -10 });
    expect(k('ArrowRight')).toEqual({ type: 'seek', delta: 10 });
    expect(k('j')).toEqual({ type: 'seek', delta: -10 });
    expect(k('l')).toEqual({ type: 'seek', delta: 10 });
  });

  it('up/down change volume, M mutes, F fullscreen, C captions, E episodes', () => {
    expect(k('ArrowUp')).toEqual({ type: 'volume', delta: 0.1 });
    expect(k('ArrowDown')).toEqual({ type: 'volume', delta: -0.1 });
    expect(k('m')).toEqual({ type: 'mute' });
    expect(k('f')).toEqual({ type: 'fullscreen' });
    expect(k('c')).toEqual({ type: 'captions' });
    expect(k('e')).toEqual({ type: 'episodes' });
  });

  it('Shift+N / Shift+P switch episodes, plain N/P do nothing', () => {
    expect(k('N', { shiftKey: true })).toEqual({ type: 'next' });
    expect(k('P', { shiftKey: true })).toEqual({ type: 'prev' });
    expect(k('n')).toBeNull();
    expect(k('p')).toBeNull();
  });

  it('number keys jump to that tenth of the episode', () => {
    expect(k('0')).toEqual({ type: 'seek-percent', percent: 0 });
    expect(k('5')).toEqual({ type: 'seek-percent', percent: 50 });
    expect(k('9')).toEqual({ type: 'seek-percent', percent: 90 });
  });

  it('< and > change speed', () => {
    expect(k('<', { shiftKey: true })).toEqual({ type: 'speed', delta: -0.25 });
    expect(k('>', { shiftKey: true })).toEqual({ type: 'speed', delta: 0.25 });
  });

  it('browser shortcuts with Ctrl/Cmd/Alt are left alone', () => {
    expect(k('f', { ctrlKey: true })).toBeNull();
    expect(k('l', { metaKey: true })).toBeNull();
    expect(k('ArrowLeft', { altKey: true })).toBeNull();
  });

  it('typing in a text box never triggers shortcuts, but the seek slider does', () => {
    const text = document.createElement('input');
    const range = document.createElement('input');
    range.type = 'range';
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(range)).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });
});
