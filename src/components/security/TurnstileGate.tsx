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
    const p = window.location.pathname;
    let framed = false;
    try { framed = window.self !== window.top; } catch { framed = true; }
    // Embed players (any embed link, or anything loaded inside another site) never show the gate.
    if (p.startsWith('/s2') || p.startsWith('/embed') || p.startsWith('/e/') || framed ||
        /^\/[A-Za-z0-9]{6,12}$/.test(p) && /[A-Z]/.test(p)) return;
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
      className="app-global-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300 backdrop-blur-xl"
      style={{ background: "radial-gradient(130% 90% at 50% 0%, hsl(var(--primary) / .28), hsl(var(--background) / .78) 58%, hsl(var(--background) / .92))" }}
      role="dialog"
      aria-modal="true"
      aria-label="Verifying you are human"
    >
      {/* Liquid glass card */}
      <div
        className="relative w-full max-w-[300px] mx-auto overflow-hidden rounded-[28px] font-popup border border-border/60"
        style={{
          background: "var(--utility-glass-fill)",
          boxShadow: "var(--utility-glass-shadow), 0 40px 90px -24px hsl(var(--primary) / .45)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
        }}
      >
        {/* Liquid sheen + specular edge */}
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-br from-foreground/[0.07] via-transparent to-transparent rotate-12 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-2/3 h-20 rounded-full blur-3xl pointer-events-none transition-colors duration-500"
          style={{ background: verified ? "hsl(160 84% 39% / .25)" : "hsl(var(--primary) / .3)" }}
        />

        <div className="relative z-10 px-6 py-7 flex flex-col items-center text-center">
          {/* Liquid orb */}
          <div className="relative h-[72px] w-[72px] mb-4">
            <div
              className={`absolute inset-0 rounded-full blur-xl transition-colors duration-500 ${verified ? "" : "animate-pulse"}`}
              style={{ background: verified ? "hsl(160 84% 39% / .35)" : "hsl(var(--primary) / .35)" }}
            />
            {!verified && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent"
                  style={{ borderTopColor: "hsl(var(--primary))", borderRightColor: "hsl(var(--primary) / .6)", animation: "spin 1.4s linear infinite" }}
                />
                <div
                  className="absolute inset-1.5 rounded-full border-2 border-transparent"
                  style={{ borderBottomColor: "hsl(var(--foreground) / .5)", borderLeftColor: "hsl(var(--primary) / .5)", animation: "spin 2s linear infinite reverse" }}
                />
              </>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all duration-500 border border-foreground/20"
                style={{
                  background: verified
                    ? "linear-gradient(135deg, hsl(160 84% 45%), hsl(160 84% 30%))"
                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / .65))",
                  boxShadow: verified
                    ? "0 0 26px hsl(160 84% 39% / .6), inset 0 1px 1px hsl(0 0% 100% / .35)"
                    : "0 0 26px hsl(var(--primary) / .7), inset 0 1px 1px hsl(0 0% 100% / .35)",
                }}
              >
                {verified ? (
                  <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-primary-foreground drop-shadow" />
                )}
              </div>
            </div>
          </div>

          {/* Status pill */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] mb-2 transition-colors border-border/60 bg-foreground/[0.06]"
            style={{ color: verified ? "hsl(160 84% 55%)" : "hsl(var(--foreground) / .8)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: verified ? "hsl(160 84% 50%)" : "hsl(var(--primary))" }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: verified ? "hsl(160 84% 50%)" : "hsl(var(--primary))" }}
              />
            </span>
            {verified ? "Verified" : "Security Check"}
          </div>

          <h2 className="text-base font-bold tracking-tight text-foreground">
            {verified ? "You're all set" : "Verify you are human"}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed px-2">
            {verified
              ? "Verification complete. Taking you in…"
              : "Performing a quick security check. This only takes a moment."}
          </p>

          {/* Liquid progress bar */}
          <div className="relative mt-5 h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
            {verified ? (
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(160 84% 45%), hsl(160 84% 35%))", boxShadow: "0 0 12px hsl(160 84% 39% / .6)" }}
              />
            ) : (
              <div
                className="absolute inset-y-0 left-0 w-1/3 rounded-full animate-[turnstile_1.4s_ease-in-out_infinite]"
                style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)", boxShadow: "0 0 12px hsl(var(--primary) / .7)" }}
              />
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between w-full text-[9px] uppercase tracking-wider text-muted-foreground/70">
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
        @media (prefers-reduced-motion: reduce) {
          .app-global-overlay * { animation: none !important; transition: none !important; }
        }
        html.perf-low .app-global-overlay, html.perf-low .app-global-overlay > div {
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
        }
      `}</style>
    </div>
  );
};

export default TurnstileGate;
