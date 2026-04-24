import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LucideIcon } from 'lucide-react';

interface SeeAllHeaderProps {
  /** Lucide icon for the badge tile */
  icon: LucideIcon;
  /** Big title (e.g. "Latest Series") */
  title: string;
  /** Subtitle/description under the title */
  subtitle: string;
  /** Optional eyebrow chip text shown above the title */
  eyebrow?: string;
  /** Tailwind gradient classes for the icon tile (e.g. 'from-primary to-pink-500') */
  iconGradient?: string;
  /** Tailwind tone for the background glow blobs (e.g. 'bg-primary/20') */
  glowTone?: string;
  /** Right-side stat chips */
  stats?: Array<{ icon?: LucideIcon; label: string; value: string | number; tone?: string }>;
  /** Optional extra slot below the title (filters etc.) */
  children?: ReactNode;
  /** Where the back arrow should navigate (default '/') */
  backHref?: string;
}

/**
 * Unified cinematic header for "see all" / listing pages.
 * Matches the premium aesthetic used on /crunchy and /musein.
 */
export function SeeAllHeader({
  icon: Icon,
  title,
  subtitle,
  eyebrow,
  iconGradient = 'from-primary via-primary to-pink-500',
  glowTone = 'bg-primary/20',
  stats,
  children,
  backHref = '/',
}: SeeAllHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
      <div className={`absolute -top-24 right-1/4 w-[28rem] h-[28rem] ${glowTone} rounded-full blur-[120px]`} />
      <div className={`absolute -top-12 left-1/3 w-[20rem] h-[20rem] ${glowTone} rounded-full blur-[100px] opacity-60`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />

      <div className="container relative px-4 pt-4 pb-8 md:pt-6 md:pb-12">
        {/* Back link */}
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-5 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-7">
          {/* Icon block */}
          <div className="relative shrink-0">
            <div className={`absolute inset-0 ${glowTone} blur-2xl rounded-full`} />
            <div
              className={`relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br ${iconGradient} shadow-2xl`}
            >
              <Icon className="h-7 w-7 md:h-9 md:w-9 text-white" />
            </div>
          </div>

          {/* Title + subtitle */}
          <div className="flex-1 min-w-0">
            {eyebrow && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {eyebrow}
                </span>
              </div>
            )}
            <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tight leading-none">
              {title}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm md:text-base">
              {subtitle}
            </p>

            {stats && stats.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {stats.map((s) => {
                  const SIcon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm"
                    >
                      {SIcon && <SIcon className={`h-3.5 w-3.5 ${s.tone || 'text-primary'}`} />}
                      <span className="text-xs font-semibold tabular-nums">{s.value}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {children && <div className="mt-5">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
