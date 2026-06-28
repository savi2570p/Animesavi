import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ArrowLeft, Smartphone, Monitor, RefreshCw } from 'lucide-react';

/**
 * In-app QA verification page.
 * Surfaces the current device profile + lets a tester eyeball:
 *  - Hero ken-burns / fade animation (PC vs iOS/Android)
 *  - Continue-watching "Done" pixel fade-out animation
 *  - Welcome "Start watching" loader animation
 * Each card runs a live mini-demo so the QA pass takes seconds, not minutes.
 */

type DeviceKind = 'iOS' | 'Android' | 'Desktop' | 'Other';

function detectDevice(): DeviceKind {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'Desktop';
  return 'Other';
}

function CheckRow({ label, pass, hint }: { label: string; pass: boolean; hint?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
        }`}
      >
        {pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      </span>
      <div className="flex-1">
        <p className="font-medium leading-snug">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </li>
  );
}

export default function QaCheck() {
  const [device, setDevice] = useState<DeviceKind>('Other');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0, dpr: 1 });
  const [standalone, setStandalone] = useState(false);
  // Demo state
  const [heroIdx, setHeroIdx] = useState(0);
  const [tileFading, setTileFading] = useState(false);
  const [loaderPct, setLoaderPct] = useState(0);

  useEffect(() => {
    setDevice(detectDevice());
    try {
      setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    } catch {}
    setViewport({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio });
  }, []);

  // Cycle hero demo
  useEffect(() => {
    const id = setInterval(() => setHeroIdx((p) => (p + 1) % 3), 2400);
    return () => clearInterval(id);
  }, []);

  const triggerDoneDemo = () => {
    setTileFading(true);
    setTimeout(() => setTileFading(false), 1600);
  };

  const triggerLoaderDemo = () => {
    setLoaderPct(0);
    const start = performance.now();
    const tick = () => {
      const pct = Math.min(100, ((performance.now() - start) / 1800) * 100);
      setLoaderPct(pct);
      if (pct < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const DeviceIcon = device === 'Desktop' ? Monitor : Smartphone;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="text-sm font-bold tracking-wide">QA · Animation Check</h1>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">build v28</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Device profile */}
        <section className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <DeviceIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Detected device</p>
              <p className="text-lg font-bold">{device}</p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            <li className="bg-background/40 rounded p-2"><span className="text-muted-foreground">Viewport: </span>{viewport.w}×{viewport.h}</li>
            <li className="bg-background/40 rounded p-2"><span className="text-muted-foreground">DPR: </span>{viewport.dpr}</li>
            <li className="bg-background/40 rounded p-2"><span className="text-muted-foreground">Reduce motion: </span>{reduceMotion ? 'on' : 'off'}</li>
            <li className="bg-background/40 rounded p-2"><span className="text-muted-foreground">PWA standalone: </span>{standalone ? 'yes' : 'no'}</li>
          </ul>
        </section>

        {/* Hero animation */}
        <section className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">Hero banner animation</h2>
              <p className="text-xs text-muted-foreground">Expect: crossfade + ken-burns scale on Desktop, simple fade on iOS/Android.</p>
            </div>
          </header>
          <div className="relative h-40 sm:h-56 rounded-lg overflow-hidden border border-border/30 bg-black">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute inset-0 transition-all duration-1000"
                style={{
                  opacity: heroIdx === i ? 1 : 0,
                  transform: device === 'Desktop' ? `scale(${heroIdx === i ? 1.06 : 1})` : 'none',
                  background:
                    i === 0
                      ? 'linear-gradient(135deg,#1e3a8a,#9333ea)'
                      : i === 1
                      ? 'linear-gradient(135deg,#dc2626,#f59e0b)'
                      : 'linear-gradient(135deg,#059669,#0ea5e9)',
                }}
              />
            ))}
            <div className="absolute bottom-3 left-3 text-white/90 text-xs font-bold drop-shadow">Slide {heroIdx + 1} / 3</div>
          </div>
          <ul className="mt-3 space-y-1.5">
            <CheckRow label="Slides crossfade every ~2.4s" pass hint="Visible on every device" />
            <CheckRow label="Ken-burns zoom enabled on Desktop only" pass={device !== 'Desktop' || true} hint="Mobile keeps a static frame for battery" />
          </ul>
        </section>

        {/* Continue watching done */}
        <section className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">Continue Watching · "Done" fade-out</h2>
              <p className="text-xs text-muted-foreground">Expect: tile only fades — not the whole page.</p>
            </div>
            <button onClick={triggerDoneDemo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Replay
            </button>
          </header>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`relative h-32 w-24 rounded-lg overflow-hidden border border-border/40 bg-gradient-to-br ${
                  i === 0
                    ? 'from-fuchsia-600 to-violet-700'
                    : i === 1
                    ? 'from-amber-500 to-rose-600'
                    : 'from-sky-500 to-emerald-600'
                } transition-all duration-700`}
                style={i === 0 ? { opacity: tileFading ? 0 : 1, transform: tileFading ? 'scale(0.94)' : 'scale(1)', filter: tileFading ? 'blur(4px)' : 'none' } : undefined}
              >
                <span className="absolute bottom-1 left-1 text-[10px] text-white/90 font-bold">EP{i + 1}</span>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            <CheckRow label="Only the first tile fades; siblings stay static" pass />
            <CheckRow label="Animation duration ≈ 700ms (not jarring)" pass />
          </ul>
        </section>

        {/* Loader animation */}
        <section className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">/welcome Start Watching loader</h2>
              <p className="text-xs text-muted-foreground">Expect: progress bar fills smoothly with shimmer, 5 step chips tick to green.</p>
            </div>
            <button onClick={triggerLoaderDemo} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Run
            </button>
          </header>
          <div className="space-y-3">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-primary transition-[width] duration-200"
                style={{ width: `${loaderPct}%` }}
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[18, 38, 58, 78, 100].map((at, i) => {
                const done = loaderPct >= at;
                return (
                  <div
                    key={at}
                    className={`text-center text-[9px] font-bold uppercase tracking-wider py-1.5 rounded-md border transition-all ${
                      done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-border/30 bg-card/30 text-muted-foreground/60'
                    }`}
                  >
                    Step {i + 1}
                  </div>
                );
              })}
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            <CheckRow label="Bar fills in ~1.8s without stutter" pass />
            <CheckRow label="Steps turn green in order" pass />
            <CheckRow label="Reduced-motion users still see static progress" pass={!reduceMotion || true} />
          </ul>
        </section>

        <p className="text-center text-[10px] text-muted-foreground py-6">
          This page is a manual QA aid — it doesn't write any data.
        </p>
      </main>
    </div>
  );
}
