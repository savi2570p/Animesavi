import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Check } from "lucide-react";

export const STORAGE_KEY = "verificationExpiresAt";
export const DURATION_MS = 24 * 60 * 60 * 1000; // 24h
export const ANALYTICS_KEY = "turnstileAnalytics"; // rolling client-side log

type Phase = "idle" | "verifying" | "verified";

export type TurnstileEvent = {
  ts: number;
  type: "shown" | "verified" | "skipped" | "bot_blocked";
  loadMs?: number;     // time from mount to modal shown
  durationMs?: number; // verifying -> verified duration
  ua?: string;
};

export const isBotLike = (ua: string = (typeof navigator !== "undefined" ? navigator.userAgent : "")): boolean => {
  if (!ua) return false;
  if (/bot|crawl|spider|headless|phantom|puppeteer|selenium/i.test(ua)) return true;
  try {
    // @ts-ignore
    if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  } catch {}
  return false;
};

export const isVerifiedNow = (now: number = Date.now()): boolean => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    const exp = parseInt(v, 10);
    return Number.isFinite(exp) && now < exp;
  } catch {
    return false;
  }
};

export const markVerified = (now: number = Date.now()): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(now + DURATION_MS));
  } catch {}
};

export const clearVerification = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

export const recordAnalytics = (ev: TurnstileEvent): void => {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const list: TurnstileEvent[] = raw ? JSON.parse(raw) : [];
    list.push(ev);
    // Keep last 100 events (bounded, no perf impact)
    const trimmed = list.slice(-100);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
    // Broadcast for any dashboards listening
    window.dispatchEvent(new CustomEvent("turnstile:event", { detail: ev }));
  } catch {}
};

export const readAnalytics = (): TurnstileEvent[] => {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? (JSON.parse(raw) as TurnstileEvent[]) : [];
  } catch {
    return [];
  }
};

export const getAnalyticsSummary = (events: TurnstileEvent[] = readAnalytics()) => {
  const shown = events.filter((e) => e.type === "shown");
  const verified = events.filter((e) => e.type === "verified");
  const blocked = events.filter((e) => e.type === "bot_blocked");
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const loadMs = avg(shown.map((e) => e.loadMs ?? 0).filter(Boolean));
  const completeMs = avg(verified.map((e) => e.durationMs ?? 0).filter(Boolean));
  const successRate = shown.length ? verified.length / shown.length : 0;
  return {
    total: events.length,
    shown: shown.length,
    verified: verified.length,
    blocked: blocked.length,
    avgLoadMs: Math.round(loadMs),
    avgCompleteMs: Math.round(completeMs),
    successRate: Number(successRate.toFixed(3)),
  };
};

export const TurnstileGate = () => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const mountedAt = performance.now();
    if (isVerifiedNow()) {
      recordAnalytics({ ts: Date.now(), type: "skipped" });
      return;
    }

    const ua = navigator.userAgent || "";
    const bot = isBotLike(ua);

    setOpen(true);
    setPhase("verifying");
    const shownAt = performance.now();
    recordAnalytics({
      ts: Date.now(),
      type: "shown",
      loadMs: Math.round(shownAt - mountedAt),
      ua,
    });

    const delay = 1100 + Math.floor(Math.random() * 1400);
    const botPenalty = bot ? 4000 : 0;
    const startedAt = performance.now();

    const t = window.setTimeout(() => {
      const now = Date.now();
      const durationMs = Math.round(performance.now() - startedAt);
      if (bot) {
        recordAnalytics({ ts: now, type: "bot_blocked", durationMs, ua });
      }
      markVerified(now);
      recordAnalytics({ ts: now, type: "verified", durationMs, ua });
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
              {phase === "verified" ? "Verification complete." : "This may take a few seconds."}
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
