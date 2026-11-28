import { createPortal } from 'react-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, LockOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPinEnabled,
  getPinStatus,
  getPinLength,
  verifyPin,
  PIN_MAX_ATTEMPTS,
} from '@/lib/pinLock';

// Fail closed until the server status check finishes.
if (typeof window !== 'undefined') {
  (window as unknown as { __pinLocked?: boolean }).__pinLocked = isPinEnabled();
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Haptics are optional.
  }
}

export function PinLockGate() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [needsPin, setNeedsPin] = useState(false);
  const [length, setLength] = useState<4 | 6>(4);
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isLockedOut = lockedUntil !== null && lockedUntil > now;
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const evaluate = async () => {
      if (isAuthLoading) return;
      if (!user) {
        setNeedsPin(false);
        return;
      }
      try {
        const status = await getPinStatus();
        if (cancelled) return;
        setLength(status.length);
        setAttempts(status.attempts);
        setLockedUntil(status.locked_until);
        setNeedsPin(status.enabled && !status.unlocked);
        setStatusError(null);
        if (!status.enabled || status.unlocked) setEntered('');
      } catch {
        if (cancelled) return;
        // If a previously enabled PIN cannot be checked, fail closed. A random
        // browser-storage token never unlocks the gate by itself.
        setNeedsPin(isPinEnabled());
        setStatusError('Could not verify PIN security. Check your connection.');
      }
    };
    void evaluate();
    const onChange = () => void evaluate();
    window.addEventListener('pinlock:changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('pinlock:changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  useEffect(() => {
    if (!needsPin || entered.length !== length || checkingRef.current || isLockedOut) return;
    checkingRef.current = true;
    setChecking(true);
    const pinAttempt = entered;
    (async () => {
      try {
        const result = await verifyPin(pinAttempt);
        setAttempts(result.attempts);
        setLockedUntil(result.lockedUntil);
        setNow(Date.now());
        if (result.ok) {
          vibrate(20);
          setSuccess(true);
          setError(false);
          setTimeout(() => {
            setNeedsPin(false);
            setEntered('');
            setSuccess(false);
            setAttempts(0);
          }, 260);
        } else {
          vibrate([40, 60, 40]);
          setError(true);
          setTimeout(() => {
            setEntered('');
            setError(false);
          }, 420);
        }
      } catch {
        setStatusError('Could not verify your PIN. Please try again.');
        setError(true);
        setTimeout(() => {
          setEntered('');
          setError(false);
        }, 420);
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    })();
  }, [entered, length, needsPin, isLockedOut]);

  // Hide and disable the app behind the gate (not just overlay it) and tell
  // data hooks the session is PIN-locked.
  useEffect(() => {
    const root = document.getElementById('root');
    (window as unknown as { __pinLocked?: boolean }).__pinLocked = needsPin;
    window.dispatchEvent(new Event('pinlock:state'));
    if (!root) return;
    if (needsPin) { root.setAttribute('inert', ''); root.style.visibility = 'hidden'; }
    else { root.removeAttribute('inert'); root.style.visibility = ''; }
  }, [needsPin]);

  useEffect(() => {
    if (!needsPin) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [needsPin]);

  const press = useCallback((value: string) => {
    if (checkingRef.current || isLockedOut) return;
    setEntered((previous) => {
      if (previous.length >= length) return previous;
      vibrate(8);
      return previous + value;
    });
  }, [length, isLockedOut]);

  const back = useCallback(() => {
    if (checkingRef.current) return;
    setEntered((previous) => previous ? previous.slice(0, -1) : previous);
  }, []);

  useEffect(() => {
    if (!needsPin) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [needsPin, press, back]);

  const keys: Array<{ n: string; sub?: string }> = [
    { n: '1' }, { n: '2', sub: 'ABC' }, { n: '3', sub: 'DEF' },
    { n: '4', sub: 'GHI' }, { n: '5', sub: 'JKL' }, { n: '6', sub: 'MNO' },
    { n: '7', sub: 'PQRS' }, { n: '8', sub: 'TUV' }, { n: '9', sub: 'WXYZ' },
  ];
  const attemptsLeft = Math.max(0, PIN_MAX_ATTEMPTS - attempts);
  const message = statusError
    ? statusError
    : isLockedOut
      ? `Too many wrong PINs. Try again in ${formatRemaining((lockedUntil ?? now) - now)}`
      : error
        ? attemptsLeft > 0 ? `Wrong PIN · ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left` : 'Wrong PIN'
        : success
          ? 'Unlocked'
          : checking
            ? 'Checking…'
            : attempts > 0
              ? `${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left before a 1-hour lock`
              : `Enter your ${length}-digit PIN`;

  return createPortal(
    <AnimatePresence>
      {needsPin && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pin-v2-gate" data-pin-gate role="dialog" aria-modal="true" aria-labelledby="pin-gate-title"
        >
          <span className="pin-v2-orb pin-v2-orb-a" aria-hidden="true" />
          <span className="pin-v2-orb pin-v2-orb-b" aria-hidden="true" />
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.7 }}
            className="pin-v2-card" data-state={error ? 'error' : success ? 'success' : undefined}
          >
            <span className="pin-v2-card-edge" aria-hidden="true" />
            <div className="pin-v2-badge">
              <span className="pin-v2-badge-ring" aria-hidden="true" />
              <span className="pin-v2-badge-core">{success ? <LockOpen /> : <Lock />}</span>
            </div>
            <p className="pin-v2-eyebrow">AnimeSavi</p>
            <h2 id="pin-gate-title" className="pin-v2-title">{success ? 'Welcome back' : isLockedOut ? 'Temporarily locked' : 'Locked'}</h2>
            <p className="pin-v2-message" aria-live="polite" data-tone={error || isLockedOut || statusError ? 'error' : success ? 'ok' : undefined}>{message}</p>
            <motion.div
              animate={error ? { x: [-9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.38 }} className="pin-v2-dots" aria-hidden="true"
            >
              {Array.from({ length }).map((_, index) => (
                <motion.span
                  key={index}
                  animate={{ scale: index < entered.length && !error ? 1.12 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="pin-v2-dot" data-filled={index < entered.length || undefined}
                />
              ))}
            </motion.div>
            <div className="pin-v2-keypad">
              {keys.map((key) => (
                <button key={key.n} type="button" disabled={checking || success || isLockedOut} onClick={() => press(key.n)} className="pin-v2-key" aria-label={key.n}>
                  <span className="pin-v2-key-num">{key.n}</span>
                  {key.sub && <span className="pin-v2-key-sub">{key.sub}</span>}
                </button>
              ))}
              <span aria-hidden="true" />
              <button type="button" disabled={checking || success || isLockedOut} onClick={() => press('0')} className="pin-v2-key" aria-label="0">
                <span className="pin-v2-key-num">0</span>
              </button>
              <button type="button" disabled={checking || success || isLockedOut || entered.length === 0} onClick={back} aria-label="Delete" className="pin-v2-key pin-v2-key-ghost">
                <Delete />
              </button>
            </div>
            <p className="pin-v2-foot">Server-verified · locks again when you close this tab</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** True while the signed-in session still needs its PIN; data views wait. */
export function usePinLocked() {
  const read = () => Boolean((window as unknown as { __pinLocked?: boolean }).__pinLocked);
  const [locked, setLocked] = useState(read);
  useEffect(() => {
    const on = () => setLocked(read());
    window.addEventListener('pinlock:state', on);
    return () => window.removeEventListener('pinlock:state', on);
  }, []);
  return locked;
}
