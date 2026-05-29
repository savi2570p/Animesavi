import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete } from "lucide-react";
import {
  isPinEnabled,
  isUnlocked,
  getPinLength,
  verifyPin,
  markUnlocked,
} from "@/lib/pinLock";

export function PinLockGate() {
  const [needsPin, setNeedsPin] = useState(false);
  const [length, setLength] = useState<4 | 6>(4);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const checkingRef = useRef(false);

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

  useEffect(() => {
    if (!needsPin) return;
    if (entered.length !== length || checkingRef.current) return;
    checkingRef.current = true;
    (async () => {
      const ok = await verifyPin(entered);
      if (ok) {
        markUnlocked();
        setNeedsPin(false);
        setEntered("");
        setError(false);
      } else {
        setError(true);
        setTimeout(() => {
          setEntered("");
          setError(false);
        }, 450);
      }
      checkingRef.current = false;
    })();
  }, [entered, length, needsPin]);

  // Lock scroll while gate is up
  useEffect(() => {
    if (!needsPin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [needsPin]);

  const press = (n: string) => {
    setEntered((p) => (p.length >= length ? p : p + n));
  };
  const back = () => setEntered((p) => p.slice(0, -1));

  return (
    <AnimatePresence>
      {needsPin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-[92vw] max-w-sm px-6 py-8 rounded-3xl border border-border/50 bg-card/70 backdrop-blur-2xl shadow-2xl"
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
              transition={{ duration: 0.4 }}
              className="flex justify-center gap-3 mb-7"
            >
              {Array.from({ length }).map((_, i) => {
                const filled = i < entered.length;
                return (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full border transition-all ${
                      error
                        ? "border-destructive bg-destructive"
                        : filled
                        ? "bg-primary border-primary scale-110"
                        : "border-border bg-transparent"
                    }`}
                  />
                );
              })}
            </motion.div>

            {/* keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => press(n)}
                  className="h-14 rounded-2xl bg-muted/50 hover:bg-primary/15 active:scale-95 transition-all text-xl font-semibold border border-border/40"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => press("0")}
                className="h-14 rounded-2xl bg-muted/50 hover:bg-primary/15 active:scale-95 transition-all text-xl font-semibold border border-border/40"
              >
                0
              </button>
              <button
                type="button"
                onClick={back}
                aria-label="Delete"
                className="h-14 rounded-2xl bg-muted/30 hover:bg-destructive/15 active:scale-95 transition-all flex items-center justify-center border border-border/40"
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
