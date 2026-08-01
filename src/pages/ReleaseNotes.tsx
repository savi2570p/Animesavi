import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Wrench, FlaskConical, Download } from 'lucide-react';
import {
  APP_VERSION,
  RELEASE_DATE,
  DOWNLOAD_SIZE_MB,
  BETA_NOTE,
  VERSION_GROUPS,
  BADGE_LABELS,
  BADGE_STYLES,
  BADGE_DOT,
  BADGE_ICON_RINGS,
  type ChangelogItem,
} from '@/data/releaseNotes';

const Section = ({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: ChangelogItem[];
}) => {
  if (!items.length) return null;
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-violet-300/15 bg-purple-950/25 backdrop-blur-2xl p-4 sm:p-6 shadow-[0_24px_70px_-20px_rgba(76,29,149,0.6),inset_0_1px_1px_rgba(216,180,254,0.16)]">
      <div className="pointer-events-none absolute -top-1/2 -left-1/2 h-[200%] w-[200%] rotate-12 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
      <div className="relative">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-white tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/15 text-violet-200">
            {icon}
          </span>
          {title}
        </h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br text-base shadow-md ${BADGE_ICON_RINGS[item.badge]}`}
              >
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wider ${BADGE_STYLES[item.badge]}`}
                  >
                    <span className={`h-1 w-1 rounded-full ${BADGE_DOT[item.badge]}`} />
                    {BADGE_LABELS[item.badge]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-[13px] leading-relaxed text-violet-200/60">
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default function ReleaseNotes() {
  const navigate = useNavigate();
  const group = VERSION_GROUPS[0];
  const improvements = group.items.filter((i) => i.badge !== 'FIX');
  const fixes = group.items.filter((i) => i.badge === 'FIX');

  return (
    <main className="relative min-h-screen bg-[radial-gradient(120%_80%_at_50%_0%,rgba(91,33,182,0.35),rgba(20,5,40,0.9)_55%,rgba(8,2,20,1))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,0.35),transparent)] blur-2xl" />

      <div
        className="relative mx-auto w-full max-w-3xl px-4 pb-16"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-purple-950/40 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-md transition hover:bg-violet-500/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <header className="relative overflow-hidden rounded-[32px] border border-violet-300/15 bg-purple-950/25 p-5 sm:p-7 backdrop-blur-3xl shadow-[0_28px_80px_-14px_rgba(76,29,149,0.7),inset_0_1px_1px_rgba(216,180,254,0.18)]">
          <div className="pointer-events-none absolute -bottom-12 left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3 w-3" />
              {APP_VERSION} • {RELEASE_DATE}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Release Notes
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-violet-200/65">
              {group.highlight}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/[0.08] px-3 py-1.5 text-xs font-semibold text-violet-100">
              <Download className="h-3.5 w-3.5 text-violet-300" />
              Update size · {DOWNLOAD_SIZE_MB}MB
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-5">
          <Section title="Improvements" icon={<Sparkles className="h-4 w-4" />} items={improvements} />
          <Section title="Fixes" icon={<Wrench className="h-4 w-4" />} items={fixes} />

          <section className="relative overflow-hidden rounded-[28px] border border-amber-300/20 bg-amber-500/[0.06] p-4 sm:p-6 backdrop-blur-2xl">
            <h2 className="flex items-center gap-2 text-base font-bold text-amber-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-500/15 text-amber-200">
                <FlaskConical className="h-4 w-4" />
              </span>
              Embed Player · BETA 2.1
            </h2>
            <p className="mt-3 text-xs sm:text-[13px] leading-relaxed text-amber-100/70">{BETA_NOTE}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
