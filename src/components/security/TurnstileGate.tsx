import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Check } from "lucide-react";

const STORAGE_KEY = "verificationExpiresAt";
const DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

type Phase = "idle" | "verifying" | "verified";

const isBotLike = () => {
  try {
    const ua = navigator.userAgent || "";
    if (/bot|crawl|spider|headless|phantom|puppeteer/i.test(ua)) return true;
    // @ts-ignore
    if (navigator.webdriver) return true;
  } catch {}
  return false;
};

const isVerified = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    const exp = parseInt(v, 10);
    return Number.isFinite(exp) && Date.now() < exp;
  } catch {
    return false;
  }
};

export const TurnstileGate = () => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (isVerified()) return;
    setOpen(true);
    setPhase("verifying");

    // Passive bot check + variable delay (1-3s) to feel natural
    const delay = 1100 + Math.floor(Math.random() * 1400);
    const botPenalty = isBotLike() ? 4000 : 0;

    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now() + DURATION_MS));
      } catch {}
      setPhase("verified");
      window.setTimeout(() => setOpen(false), 650);
    }, delay + botPenalty);

    return () => window.clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Verifying you are human"
    >
      <div className="w-[320px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl shadow-black/50 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center">
            {phase === "verified" ? (
              <Check className="h-5 w-5 text-emerald-400" strokeWidth={3} />
            ) : (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white/90 leading-tight">
              {phase === "verified" ? "Success!" : "Verifying you are human."}
            </div>
            <div className="text-[11px] text-white/50 mt-0.5 leading-tight">
              {phase === "verified"
                ? "Verification complete."
                : "This may take a few seconds."}
            </div>
          </div>
        </div>

        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={
              phase === "verified"
                ? "h-full w-full bg-emerald-400 transition-all duration-500"
                : "h-full w-1/3 bg-primary animate-[turnstile_1.4s_ease-in-out_infinite]"
            }
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            AnimeSavi Security
          </span>
          <span>Privacy · Terms</span>
        </div>
      </div>

      <style>{`
        @keyframes turnstile {
          0% { transform: translateX(-100%); width: 33%; }
          50% { transform: translateX(100%); width: 50%; }
          100% { transform: translateX(300%); width: 33%; }
        }
      `}</style>
    </div>
  );
};

export default TurnstileGate;
