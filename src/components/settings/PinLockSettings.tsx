import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock, ShieldCheck, KeyRound } from "lucide-react";
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
    }
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

  const digitsOnly = (v: string, max: number) =>
    v.replace(/\D/g, "").slice(0, max);

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          PIN Lock
        </CardTitle>
        <CardDescription>
          Require a {length}-digit PIN to open this site. Re-locks every time you close the tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">
              {enabled ? "PIN lock is active" : "Enable PIN lock"}
            </Label>
          </div>
          <Switch checked={enabled || mode === "create"} onCheckedChange={onToggle} />
        </div>

        {enabled && mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode("change-verify")}
              className="border-border/50"
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              Change PIN
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMode("disable-verify")}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Disable
            </Button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/40"
            >
              <div className="flex items-center gap-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">PIN length</Label>
                <div className="flex gap-1.5">
                  {[4, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setLength(n as PinLength);
                        setStep1("");
                        setStep2("");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        length === n
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {n} digits
                    </button>
                  ))}
                </div>
              </div>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={`Enter ${length}-digit PIN`}
                value={step1}
                onChange={(e) => setStep1(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Confirm PIN"
                value={step2}
                onChange={(e) => setStep2(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={busy} className="flex-1 bg-gradient-to-r from-primary to-rose-500 text-white">
                  Enable PIN
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {mode === "change-verify" && (
            <motion.div
              key="cv"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/40"
            >
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Current PIN"
                value={step1}
                onChange={(e) => setStep1(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <div className="flex gap-2">
                <Button onClick={handleChangeVerify} disabled={busy || step1.length !== length} className="flex-1">
                  Continue
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {mode === "change-new" && (
            <motion.div
              key="cn"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/40"
            >
              <div className="flex items-center gap-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">New length</Label>
                <div className="flex gap-1.5">
                  {[4, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setLength(n as PinLength);
                        setStep1("");
                        setStep2("");
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        length === n
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {n} digits
                    </button>
                  ))}
                </div>
              </div>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`New ${length}-digit PIN`}
                value={step1}
                onChange={(e) => setStep1(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Confirm new PIN"
                value={step2}
                onChange={(e) => setStep2(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <div className="flex gap-2">
                <Button onClick={handleChangeNew} disabled={busy} className="flex-1 bg-gradient-to-r from-primary to-rose-500 text-white">
                  Save new PIN
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </motion.div>
          )}

          {mode === "disable-verify" && (
            <motion.div
              key="dv"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-3 p-4 rounded-xl bg-destructive/5 border border-destructive/30"
            >
              <p className="text-xs text-destructive">Enter your current PIN to disable the lock.</p>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Current PIN"
                value={step1}
                onChange={(e) => setStep1(digitsOnly(e.target.value, length))}
                className="text-center tracking-[0.5em] font-mono h-11"
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDisable} disabled={busy || step1.length !== length} className="flex-1">
                  Disable PIN lock
                </Button>
                <Button variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
