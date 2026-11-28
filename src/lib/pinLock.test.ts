import { beforeEach, describe, expect, it } from 'vitest';
import { getPinLength, getPinSessionToken, PIN_LOCKOUT_MS, PIN_MAX_ATTEMPTS } from './pinLock';

describe('PIN session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not treat the old editable boolean as an unlock credential', () => {
    sessionStorage.setItem('as_pin_unlocked_v1', '1');
    expect(getPinSessionToken()).toBeNull();
  });

  it('accepts only a high-entropy session-token shape for server validation', () => {
    sessionStorage.setItem('as_pin_session_v1', 'a'.repeat(64));
    expect(getPinSessionToken()).toBe('a'.repeat(64));
  });

  it('retains the requested three-attempt one-hour policy constants', () => {
    expect(PIN_MAX_ATTEMPTS).toBe(3);
    expect(PIN_LOCKOUT_MS).toBe(60 * 60 * 1000);
  });

  it('supports only four or six digit PIN lengths', () => {
    expect(getPinLength()).toBe(4);
    localStorage.setItem('as_pin_length_v1', '6');
    expect(getPinLength()).toBe(6);
    localStorage.setItem('as_pin_length_v1', '5');
    expect(getPinLength()).toBe(4);
  });
});
