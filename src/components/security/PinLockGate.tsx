import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete, LockOpen } from "lucide-react";
import {
  isPinEnabled,
  isUnlocked,
  getPinLength,
  verifyPin,
  markUnlocked,
  getPinLockoutUntil,
  getFailedPinAttempts,
  recordFailedPinAttempt,
  resetPinAttempts,
  PIN_MAX_ATTEMPTS,
} from "@/lib/pinLock";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* noop */
  }
}

export function PinLockGate() {
  const [needsPin, setNeedsPin] = useState(false);
  const [length, setLength] = useState<4 | 6>(4);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(() => getFailedPinAttempts());
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => getPinLockoutUntil());
  const [now, setNow] = useState(() => Date.now());
  const isLockedOut = lockedUntil !== null && lockedUntil > now;
  const checkingRef = useRef(false);
  const enteredRef = useRef("");

  useEffect(() => {
    enteredRef.current = entered;
  }, [entered]);

  useEffect(() => {
    const evaluate = () => {
      const enabled = isPinEnabled();
      const unlocked = isUnlocked();
      setLength(getPinLength());
      setNeedsPin(enabled && !unlocked);
      setLockedUntil(getPinLockoutUntil());
      setAttempts(getFailedPinAttempts());
      if (!enabled || unlocked) setEntered("");
    };
    evaluate();
    const onChange = () => evaluate();
    window.addEventListener("pinlock:changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("pinlock:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Tick the lockout countdown; re-open the keypad once the hour has passed.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        setLockedUntil(getPinLockoutUntil(t));
        setAttempts(getFailedPinAttempts());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  // Verify PIN once the buffer reaches the required length.
  useEffect(() => {
    if (!needsPin) return;
    if (entered.length !== length || checkingRef.current) return;
    if (getPinLockoutUntil() !== null) {
      setEntered("");
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    const pinAttempt = entered;
    (async () => {
      const ok = await verifyPin(pinAttempt);
      if (ok) {
        vibrate(20);
        setSuccess(true);
        setError(false);
        // Brief unlocked state before the gate fades away.
        setTimeout(() => {
          markUnlocked();
          setNeedsPin(false);
          setEntered("");
          setSuccess(false);
          resetPinAttempts();
          setAttempts(0);
        }, 260);
      } else {
        vibrate([40, 60, 40]);
        const result = recordFailedPinAttempt();
        setAttempts(result.attempts);
        if (result.lockedUntil) {
          setNow(Date.now());
          setLockedUntil(result.lockedUntil);
        }
        setError(true);
        setTimeout(() => {
          setEntered("");
          setError(false);
        }, 420);
      }
      checkingRef.current = false;
      setChecking(false);
    })();
  }, [entered, length, needsPin]);

  // Lock page scroll while gate is visible.
  useEffect(() => {
    if (!needsPin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [needsPin]);

  const press = useCallback(
    (n: string) => {
      if (checkingRef.current || getPinLockoutUntil() !== null) return;
      setEntered((p) => {
        if (p.length >= length) return p;
        vibrate(8);
        return p + n;
      });
    },
    [length],
  );

  const back = useCallback(() => {
    if (checkingRef.current) return;
    setEntered((p) => {
      if (!p) return p;
      vibrate(8);
      return p.slice(0, -1);
    });
  }, []);

  // Physical keyboard support (numpad + backspace) for desktop stability.
  useEffect(() => {
    if (!needsPin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [needsPin, press, back]);

  const keys: Array<{ n: string; sub?: string }> = [
    { n: "1" }, { n: "2", sub: "ABC" }, { n: "3", sub: "DEF" },
    { n: "4", sub: "GHI" }, { n: "5", sub: "JKL" }, { n: "6", sub: "MNO" },
    { n: "7", sub: "PQRS" }, { n: "8", sub: "TUV" }, { n: "9", sub: "WXYZ" },
  ];
  const attemptsLeft = Math.max(0, PIN_MAX_ATTEMPTS - attempts);
  const message = isLockedOut
    ? `Too many wrong PINs. Try again in ${formatRemaining((lockedUntil ?? now) - now)}`
    : error
    ? attemptsLeft > 0
      ? `Wrong PIN · ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left`
      : "Wrong PIN"
    : success
    ? "Unlocked"
    : checking
    ? "Checking…"
    : attempts > 0
    ? `${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left before a 1-hour lock`
    : `Enter your ${length}-digit PIN`;

  return (
    <AnimatePresence>
      {needsPin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pin-v2-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-gate-title"
        >
          <span className="pin-v2-orb pin-v2-orb-a" aria-hidden="true" />
          <span className="pin-v2-orb pin-v2-orb-b" aria-hidden="true" />

          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.7 }}
            className="pin-v2-card"
            data-state={error ? "error" : success ? "success" : undefined}
          >
            <span className="pin-v2-card-edge" aria-hidden="true" />
            <div className="pin-v2-badge">
              <span className="pin-v2-badge-ring" aria-hidden="true" />
              <span className="pin-v2-badge-core">
                {success ? <LockOpen /> : <Lock />}
              </span>
            </div>
            <p className="pin-v2-eyebrow">AnimeSavi</p>
            <h2 id="pin-gate-title" className="pin-v2-title">{success ? "Welcome back" : isLockedOut ? "Temporarily locked" : "Locked"}</h2>
            <p className="pin-v2-message" aria-live="polite" data-tone={error || isLockedOut ? "error" : success ? "ok" : undefined}>{message}</p>

            <motion.div
              animate={error ? { x: [-9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.38 }}
              className="pin-v2-dots"
              aria-hidden="true"
            >
              {Array.from({ length }).map((_, i) => {
                const filled = i < entered.length;
                return (
                  <motion.span
                    key={i}
                    animate={{ scale: filled && !error ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="pin-v2-dot"
                    data-filled={filled || undefined}
                  />
                );
              })}
            </motion.div>

            <div className="pin-v2-keypad">
              {keys.map((k) => (
                <button
                  key={k.n}
                  type="button"
                  disabled={checking || success || isLockedOut}
                  onClick={() => press(k.n)}
                  className="pin-v2-key"
                  aria-label={k.n}
                >
                  <span className="pin-v2-key-num">{k.n}</span>
                  {k.sub && <span className="pin-v2-key-sub">{k.sub}</span>}
                </button>
              ))}
              <span aria-hidden="true" />
              <button
                type="button"
                disabled={checking || success || isLockedOut}
                onClick={() => press("0")}
                className="pin-v2-key"
                aria-label="0"
              >
                <span className="pin-v2-key-num">0</span>
              </button>
              <button
                type="button"
                disabled={checking || success || isLockedOut || entered.length === 0}
                onClick={back}
                aria-label="Delete"
                className="pin-v2-key pin-v2-key-ghost"
              >
                <Delete />
              </button>
            </div>
            <p className="pin-v2-foot">Locks again when you close this tab</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
