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
    // Shadow link v2 (/s2/...) is a branding-free standalone player — no gate.
    if (window.location.pathname.startsWith('/s2')) return;
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

  const verified = phase === "verified";

  return (
    <div
      className="app-global-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(91,33,182,0.5),rgba(20,5,40,0.7)_55%,rgba(8,2,20,0.88))] backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Verifying you are human"
    >
      {/* Dark purple glass pill — matches What's New aesthetic */}
      <div className="relative w-full max-w-[320px] mx-auto overflow-hidden bg-purple-950/25 backdrop-blur-3xl border border-violet-300/15 rounded-[36px] shadow-[0_48px_120px_-20px_rgba(76,29,149,0.7),inset_0_1px_1px_rgba(216,180,254,0.18)] font-popup">
        {/* Ambient purple bloom + sheen */}
        <div className="absolute -inset-1 bg-gradient-to-b from-violet-400/15 via-purple-500/5 to-transparent rounded-[38px] blur-xl opacity-40 pointer-events-none" />
        <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-br from-white/[0.06] via-transparent to-transparent rotate-12 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-violet-200/40 to-transparent" />
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-2/3 h-20 bg-purple-600/30 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 px-6 py-7 flex flex-col items-center text-center">
          {/* Animated shield orb */}
          <div className="relative h-16 w-16 mb-4">
            <div
              className={`absolute inset-0 rounded-full blur-xl transition-colors duration-500 ${
                verified
                  ? "bg-emerald-500/40"
                  : "bg-gradient-to-br from-violet-500/40 to-purple-600/25 animate-pulse"
              }`}
            />
            {!verified && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-300 border-r-violet-400"
                  style={{ animation: "spin 1.4s linear infinite" }}
                />
                <div
                  className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-purple-300 border-l-purple-400"
                  style={{ animation: "spin 2s linear infinite reverse" }}
                />
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                  verified
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_24px_rgba(16,185,129,0.7)]"
                    : "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 shadow-[0_0_24px_rgba(139,92,246,0.8)]"
                }`}
              >
                {verified ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-white drop-shadow" />
                )}
              </div>
            </div>
          </div>

          {/* Pill label */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] mb-2 transition-colors ${
              verified
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-violet-300/30 bg-violet-500/15 text-violet-200"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  verified ? "bg-emerald-400" : "bg-violet-300"
                }`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  verified ? "bg-emerald-400" : "bg-violet-300"
                }`}
              />
            </span>
            {verified ? "Verified" : "Security Check"}
          </div>

          <h2 className="bg-gradient-to-r from-white via-violet-100 to-white bg-clip-text text-base font-bold text-transparent tracking-tight">
            {verified ? "You're all set" : "Verify you are human"}
          </h2>
          <p className="text-[11px] text-violet-200/60 mt-1 leading-relaxed px-2">
            {verified
              ? "Verification complete. Taking you in…"
              : "Performing a quick security check. This only takes a moment."}
          </p>

          {/* Shimmer progress bar */}
          <div className="relative mt-5 h-1 w-full overflow-hidden rounded-full bg-violet-300/[0.08]">
            {verified ? (
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
            ) : (
              <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-violet-300 to-transparent shadow-[0_0_12px_rgba(139,92,246,0.8)] animate-[turnstile_1.4s_ease-in-out_infinite]" />
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between w-full text-[9px] uppercase tracking-wider text-violet-200/40">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" />
              AnimeSavi Security
            </span>
            <span>Privacy · Terms</span>
          </div>
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
