import { useEffect, useState } from "react";
import { ShieldCheck, Check, Lock } from "lucide-react";
import logo from "@/assets/logo.png";

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
  const steps = [
    { label: "Checking your browser", done: true },
    { label: "Securing the connection", done: verified },
    { label: "Opening AnimeSavi+", done: verified },
  ];
  const activeIndex = verified ? -1 : 1;

  return (
    <div
      className="app-global-overlay hv2 fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hv2-title"
      aria-describedby="hv2-desc"
    >
      <div className={`hv2-card ${verified ? "is-verified" : ""}`}>
        <header className="hv2-head">
          <img src={logo} alt="" className="hv2-logo" />
          <div className="hv2-brand">
            <span className="hv2-brand-name">AnimeSavi<span className="text-primary">+</span></span>
            <span className="hv2-brand-sub">Security check</span>
          </div>
          <span className="hv2-chip" aria-hidden="true">
            <span className="hv2-chip-dot" />
            {verified ? "Verified" : "Live"}
          </span>
        </header>

        {/* Challenge widget */}
        <div className="hv2-widget" role="status" aria-live="polite">
          <span className="hv2-box" aria-hidden="true">
            {verified ? <Check className="h-4 w-4" strokeWidth={3.2} /> : <span className="hv2-spin" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="hv2-title" className="hv2-title">
              {verified ? "You're verified" : "Verifying you are human"}
            </h2>
            <p id="hv2-desc" className="hv2-desc">
              {verified ? "Taking you in now…" : "This only takes a moment."}
            </p>
          </div>
          <ShieldCheck className="hv2-shield" aria-hidden="true" />
        </div>

        <ol className="hv2-steps">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className={`hv2-step ${step.done ? "is-done" : ""} ${i === activeIndex ? "is-active" : ""}`}
            >
              <span className="hv2-dot" aria-hidden="true">
                {step.done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
              </span>
              {step.label}
            </li>
          ))}
        </ol>

        <div className="hv2-bar" aria-hidden="true">
          <span />
        </div>

        <footer className="hv2-foot">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Valid for 24 hours
          </span>
          <span>Privacy · Terms</span>
        </footer>
      </div>
    </div>
  );
};

export default TurnstileGate;
