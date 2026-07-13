import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete } from "lucide-react";
import {
  isPinEnabled,
  isUnlocked,
  getPinLength,
  verifyPin,
  markUnlocked,
} from "@/lib/pinLock";

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

  // Verify PIN once the buffer reaches the required length.
  useEffect(() => {
    if (!needsPin) return;
    if (entered.length !== length || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    const pinAttempt = entered;
    (async () => {
      const ok = await verifyPin(pinAttempt);
      if (ok) {
        vibrate(20);
        markUnlocked();
        setNeedsPin(false);
        setEntered("");
        setError(false);
      } else {
        vibrate([40, 60, 40]);
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
      if (checkingRef.current) return;
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

  return (
    <AnimatePresence>
      {needsPin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {/* glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.96, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.7 }}
            className="relative w-[92vw] max-w-sm px-6 py-8 rounded-3xl border border-border/50 bg-card/70 backdrop-blur-2xl shadow-2xl will-change-transform"
          >
            <div className="flex flex-col items-center mb-5">
              <div className="relative mb-3">
                <div className="absolute inset-0 bg-primary/40 blur-xl rounded-full" />
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center shadow-xl">
                  <Lock className="h-7 w-7 text-white" />
                </div>
              </div>
              <h2 className="text-lg font-bold">Enter PIN</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Account locked — enter your {length}-digit PIN
              </p>
            </div>

            {/* dots */}
            <motion.div
              animate={error ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.38 }}
              className="flex justify-center gap-3 mb-7"
              aria-live="polite"
            >
              {Array.from({ length }).map((_, i) => {
                const filled = i < entered.length;
                return (
                  <motion.div
                    key={i}
                    animate={{
                      scale: filled && !error ? 1.15 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className={`h-3 w-3 rounded-full border transition-colors duration-150 ${
                      error
                        ? "border-destructive bg-destructive"
                        : filled
                        ? "bg-primary border-primary"
                        : "border-border bg-transparent"
                    }`}
                  />
                );
              })}
            </motion.div>

            {/* keypad */}
            <div className="grid grid-cols-3 gap-2.5 select-none">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={checking}
                  onClick={() => press(n)}
                  className="h-14 rounded-2xl bg-muted/50 hover:bg-primary/15 active:scale-[0.94] active:bg-primary/25 transition-all duration-100 text-xl font-semibold border border-border/40 touch-manipulation disabled:opacity-70"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                type="button"
                disabled={checking}
                onClick={() => press("0")}
                className="h-14 rounded-2xl bg-muted/50 hover:bg-primary/15 active:scale-[0.94] active:bg-primary/25 transition-all duration-100 text-xl font-semibold border border-border/40 touch-manipulation disabled:opacity-70"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                0
              </button>
              <button
                type="button"
                disabled={checking || entered.length === 0}
                onClick={back}
                aria-label="Delete"
                className="h-14 rounded-2xl bg-muted/30 hover:bg-destructive/15 active:scale-[0.94] transition-all duration-100 flex items-center justify-center border border-border/40 touch-manipulation disabled:opacity-40"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Delete className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
