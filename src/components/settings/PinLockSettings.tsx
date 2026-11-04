import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Lock, ShieldCheck, KeyRound, ShieldOff, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  isPinEnabled,
  getPinLength,
  setPin,
  disablePin,
  verifyPin,
  type PinLength,
} from "@/lib/pinLock";

type Mode = "idle" | "create" | "change-verify" | "change-new" | "disable-verify";

const digitsOnly = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

/** Segmented PIN field: one real numeric input rendered as glass digit cells. */
function PinCodeField({
  label,
  value,
  length,
  onChange,
  autoFocus,
  state,
}: {
  label: string;
  value: string;
  length: number;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  state?: "match" | "mismatch";
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div className="pin-v2-field">
      <label htmlFor={id} className="pin-v2-field-label">{label}</label>
      <div className="pin-v2-cells" data-state={state} data-focused={focused || undefined}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className="pin-v2-cell"
            data-filled={i < value.length || undefined}
            data-active={focused && i === Math.min(value.length, length - 1) || undefined}
          >
            {i < value.length ? <span className="pin-v2-cell-dot" /> : null}
          </span>
        ))}
        <input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={length}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(digitsOnly(e.target.value, length))}
          className="pin-v2-input"
          aria-label={label}
        />
      </div>
    </div>
  );
}

function LengthPicker({ length, onPick, label }: { length: PinLength; onPick: (n: PinLength) => void; label: string }) {
  return (
    <div className="pin-v2-length" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>
        {[4, 6].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={length === n}
            data-active={length === n || undefined}
            onClick={() => onPick(n as PinLength)}
          >
            {n} digits
          </button>
        ))}
      </div>
    </div>
  );
}

export function PinLockSettings() {
  const [enabled, setEnabled] = useState(false);
  const [length, setLength] = useState<PinLength>(4);
  const [mode, setMode] = useState<Mode>("idle");
  const [step1, setStep1] = useState("");
  const [step2, setStep2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(isPinEnabled());
    setLength(getPinLength());
  }, []);

  const reset = () => {
    setMode("idle");
    setStep1("");
    setStep2("");
    setBusy(false);
  };

  const onToggle = (next: boolean) => {
    if (next && !enabled) {
      setMode("create");
    } else if (!next && enabled) {
      setMode("disable-verify");
    } else if (!next && mode === "create") {
      reset();
    }
  };

  const pickLength = (n: PinLength) => {
    setLength(n);
    setStep1("");
    setStep2("");
  };

  const handleCreate = async () => {
    if (step1.length !== length) return toast.error(`PIN must be ${length} digits`);
    if (step1 !== step2) return toast.error("PINs do not match");
    setBusy(true);
    await setPin(step1, length);
    setEnabled(true);
    toast.success("PIN lock enabled");
    reset();
  };

  const handleChangeVerify = async () => {
    setBusy(true);
    const ok = await verifyPin(step1);
    setBusy(false);
    if (!ok) {
      toast.error("Current PIN is incorrect");
      setStep1("");
      return;
    }
    setStep1("");
    setStep2("");
    setMode("change-new");
  };

  const handleChangeNew = async () => {
    if (step1.length !== length) return toast.error(`PIN must be ${length} digits`);
    if (step1 !== step2) return toast.error("PINs do not match");
    setBusy(true);
    await setPin(step1, length);
    toast.success("PIN updated");
    reset();
  };

  const handleDisable = async () => {
    setBusy(true);
    const ok = await verifyPin(step1);
    if (!ok) {
      toast.error("Incorrect PIN");
      setStep1("");
      setBusy(false);
      return;
    }
    disablePin();
    setEnabled(false);
    toast.success("PIN lock disabled");
    reset();
  };

  const confirmState = step2.length === length ? (step1 === step2 ? "match" : "mismatch") : undefined;
  const pairReady = step1.length === length && step1 === step2;

  const panelMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.18 },
  };

  return (
    <section className="account-v4-section pin-v2-settings" aria-labelledby="pin-lock-title">
      <header className="pin-v2-head">
        <span className="pin-v2-head-icon" data-on={enabled || undefined}><Lock /></span>
        <div className="min-w-0 flex-1">
          <h3 id="pin-lock-title">PIN Lock</h3>
          <p>Ask for a {length}-digit PIN every time this site opens in a new tab on this device.</p>
        </div>
      </header>

      <div className="pin-v2-status" data-on={enabled || undefined}>
        <span className="pin-v2-status-icon">{enabled ? <ShieldCheck /> : <ShieldOff />}</span>
        <div className="min-w-0 flex-1">
          <p className="pin-v2-status-title">{enabled ? "PIN lock is on" : "PIN lock is off"}</p>
          <p className="pin-v2-status-sub">{enabled ? `${length}-digit PIN · locks again when the tab closes` : "Turn on to protect this device"}</p>
        </div>
        <Switch checked={enabled || mode === "create"} onCheckedChange={onToggle} aria-label="PIN lock" />
      </div>

      {enabled && mode === "idle" && (
        <div className="pin-v2-actions">
          <Button variant="glass" size="sm" onClick={() => setMode("change-verify")}>
            <KeyRound /> Change PIN
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("disable-verify")} className="pin-v2-danger">
            <ShieldOff /> Turn off
          </Button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {mode === "create" && (
          <motion.div key="create" {...panelMotion} className="pin-v2-panel">
            <p className="pin-v2-step">Create your PIN</p>
            <LengthPicker length={length} onPick={pickLength} label="PIN length" />
            <PinCodeField label="New PIN" value={step1} length={length} onChange={setStep1} autoFocus />
            <PinCodeField label="Confirm PIN" value={step2} length={length} onChange={setStep2} state={confirmState} />
            {confirmState === "mismatch" && <p className="pin-v2-hint" data-tone="error">PINs do not match</p>}
            {confirmState === "match" && <p className="pin-v2-hint" data-tone="ok"><Check /> PINs match</p>}
            <div className="pin-v2-buttons">
              <Button onClick={handleCreate} disabled={busy || !pairReady} className="flex-1">Turn on PIN lock</Button>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {mode === "change-verify" && (
          <motion.div key="cv" {...panelMotion} className="pin-v2-panel">
            <p className="pin-v2-step">Step 1 of 2 · Confirm it's you</p>
            <PinCodeField label="Current PIN" value={step1} length={length} onChange={setStep1} autoFocus />
            <div className="pin-v2-buttons">
              <Button onClick={handleChangeVerify} disabled={busy || step1.length !== length} className="flex-1">Continue</Button>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {mode === "change-new" && (
          <motion.div key="cn" {...panelMotion} className="pin-v2-panel">
            <p className="pin-v2-step">Step 2 of 2 · Choose a new PIN</p>
            <LengthPicker length={length} onPick={pickLength} label="New length" />
            <PinCodeField label="New PIN" value={step1} length={length} onChange={setStep1} autoFocus />
            <PinCodeField label="Confirm new PIN" value={step2} length={length} onChange={setStep2} state={confirmState} />
            {confirmState === "mismatch" && <p className="pin-v2-hint" data-tone="error">PINs do not match</p>}
            {confirmState === "match" && <p className="pin-v2-hint" data-tone="ok"><Check /> PINs match</p>}
            <div className="pin-v2-buttons">
              <Button onClick={handleChangeNew} disabled={busy || !pairReady} className="flex-1">Save new PIN</Button>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {mode === "disable-verify" && (
          <motion.div key="dv" {...panelMotion} className="pin-v2-panel" data-tone="danger">
            <p className="pin-v2-step">Enter your current PIN to turn off the lock</p>
            <PinCodeField label="Current PIN" value={step1} length={length} onChange={setStep1} autoFocus />
            <div className="pin-v2-buttons">
              <Button variant="destructive" onClick={handleDisable} disabled={busy || step1.length !== length} className="flex-1">Turn off PIN lock</Button>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
