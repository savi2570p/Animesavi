import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Shared keyboard shortcuts for every embed player.
 * Media keys act on the <video> element; player-specific actions (fullscreen,
 * captions, episodes) only fire when the player passes a handler for them.
 */

export type EmbedHotkeyAction =
  | { type: 'toggle-play' }
  | { type: 'seek'; delta: number }
  | { type: 'seek-percent'; percent: number }
  | { type: 'seek-start' }
  | { type: 'seek-end' }
  | { type: 'volume'; delta: number }
  | { type: 'mute' }
  | { type: 'speed'; delta: number }
  | { type: 'fullscreen' }
  | { type: 'captions' }
  | { type: 'episodes' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'escape' };

export const EMBED_SEEK_STEP = 10;
export const EMBED_VOLUME_STEP = 0.1;
export const EMBED_SPEED_STEP = 0.25;
export const EMBED_SPEED_MIN = 0.25;
export const EMBED_SPEED_MAX = 2;

type KeyLike = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** Maps a key press to a player action, or null when the key isn't a shortcut. */
export function resolveEmbedHotkey(e: KeyLike): EmbedHotkeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  switch (lower) {
    case ' ':
    case 'k':
      return { type: 'toggle-play' };
    case 'ArrowLeft':
    case 'j':
      return { type: 'seek', delta: -EMBED_SEEK_STEP };
    case 'ArrowRight':
    case 'l':
      return { type: 'seek', delta: EMBED_SEEK_STEP };
    case 'ArrowUp':
      return { type: 'volume', delta: EMBED_VOLUME_STEP };
    case 'ArrowDown':
      return { type: 'volume', delta: -EMBED_VOLUME_STEP };
    case 'm':
      return { type: 'mute' };
    case 'f':
      return { type: 'fullscreen' };
    case 'c':
      return { type: 'captions' };
    case 'e':
      return { type: 'episodes' };
    case 'n':
      return e.shiftKey ? { type: 'next' } : null;
    case 'p':
      return e.shiftKey ? { type: 'prev' } : null;
    case '<':
      return { type: 'speed', delta: -EMBED_SPEED_STEP };
    case '>':
      return { type: 'speed', delta: EMBED_SPEED_STEP };
    case 'Home':
      return { type: 'seek-start' };
    case 'End':
      return { type: 'seek-end' };
    case 'Escape':
      return { type: 'escape' };
    default:
      if (/^[0-9]$/.test(key) && !e.shiftKey) return { type: 'seek-percent', percent: Number(key) * 10 };
      return null;
  }
}

/** True when the key press belongs to a text field, not the player. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
  }
  return false;
}

export interface EmbedHotkeyHandlers {
  togglePlay?: () => void;
  toggleMute?: () => void;
  toggleFullscreen?: () => void;
  toggleCaptions?: () => void;
  toggleEpisodes?: () => void;
  nextEpisode?: () => void;
  prevEpisode?: () => void;
  /** Players that keep their own speed state (menus) receive the new rate here. */
  setSpeed?: (rate: number) => void;
  onEscape?: () => void;
  /** Called after any handled shortcut (e.g. to reveal the controls). */
  onActivity?: () => void;
}

export interface EmbedHotkeyHint { id: number; text: string }

export function useEmbedHotkeys(
  videoRef: RefObject<HTMLVideoElement | null>,
  handlers: EmbedHotkeyHandlers,
  enabled = true,
): EmbedHotkeyHint | null {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [hint, setHint] = useState<EmbedHotkeyHint | null>(null);
  const hintTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const show = (text: string) => {
      setHint((h) => ({ id: (h?.id ?? 0) + 1, text }));
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHint(null), 750);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      const action = resolveEmbedHotkey(e);
      if (!action) return;
      // Let a focused button handle its own Space/Enter click.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (action.type === 'toggle-play' && e.key === ' ' && tag === 'BUTTON') return;

      const h = handlersRef.current;
      const v = videoRef.current;
      const hasMedia = !!v && v.isConnected;
      let handled = true;

      switch (action.type) {
        case 'toggle-play':
          if (!hasMedia) { handled = false; break; }
          if (h.togglePlay) h.togglePlay();
          else if (v!.paused) v!.play().catch(() => {});
          else v!.pause();
          break;
        case 'seek': {
          if (!hasMedia) { handled = false; break; }
          const end = Number.isFinite(v!.duration) ? v!.duration : Infinity;
          v!.currentTime = Math.min(Math.max(0, v!.currentTime + action.delta), end);
          show(action.delta > 0 ? `+${action.delta}s` : `−${Math.abs(action.delta)}s`);
          break;
        }
        case 'seek-percent':
          if (!hasMedia || !Number.isFinite(v!.duration) || v!.duration <= 0) { handled = false; break; }
          v!.currentTime = (v!.duration * action.percent) / 100;
          show(`${action.percent}%`);
          break;
        case 'seek-start':
          if (!hasMedia) { handled = false; break; }
          v!.currentTime = 0;
          show('Start');
          break;
        case 'seek-end':
          if (!hasMedia || !Number.isFinite(v!.duration)) { handled = false; break; }
          v!.currentTime = Math.max(0, v!.duration - 0.5);
          show('End');
          break;
        case 'volume': {
          if (!hasMedia) { handled = false; break; }
          const next = Math.min(1, Math.max(0, Math.round((v!.volume + action.delta) * 100) / 100));
          v!.volume = next;
          if (action.delta > 0 && v!.muted) {
            if (h.toggleMute) h.toggleMute(); else v!.muted = false;
          }
          show(`Volume ${Math.round(next * 100)}%`);
          break;
        }
        case 'mute':
          if (!hasMedia) { handled = false; break; }
          {
            const willMute = !v!.muted;
            if (h.toggleMute) h.toggleMute(); else v!.muted = willMute;
            show(willMute ? 'Muted' : 'Sound on');
          }
          break;
        case 'speed': {
          if (!hasMedia) { handled = false; break; }
          const rate = Math.min(EMBED_SPEED_MAX, Math.max(EMBED_SPEED_MIN, +(v!.playbackRate + action.delta).toFixed(2)));
          if (h.setSpeed) h.setSpeed(rate);
          v!.playbackRate = rate;
          show(`Speed ${rate}×`);
          break;
        }
        case 'fullscreen':
          if (!h.toggleFullscreen) { handled = false; break; }
          h.toggleFullscreen();
          break;
        case 'captions':
          if (!h.toggleCaptions) { handled = false; break; }
          h.toggleCaptions();
          show('Subtitles');
          break;
        case 'episodes':
          if (!h.toggleEpisodes) { handled = false; break; }
          h.toggleEpisodes();
          break;
        case 'next':
          if (!h.nextEpisode) { handled = false; break; }
          h.nextEpisode();
          show('Next episode');
          break;
        case 'prev':
          if (!h.prevEpisode) { handled = false; break; }
          h.prevEpisode();
          show('Previous episode');
          break;
        case 'escape':
          if (!h.onEscape) { handled = false; break; }
          h.onEscape();
          break;
      }

      if (handled) {
        if (action.type !== 'escape') e.preventDefault();
        h.onActivity?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, [enabled, videoRef]);

  return hint;
}
