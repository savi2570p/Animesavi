import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Info,
  Calendar,
  Clock,
  Eye,
  Heart,
  Flame,
  ListVideo,
  Sparkles,
  Star,
  Tv,
} from 'lucide-react';
import { getViewCount, formatViews, getLikeCount, formatLikes } from '@/lib/viewCount';

interface MoreInfoAnime {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  genres: string[] | null;
  release_year: number | null;
  status: string | null;
  type: string | null;
  view_count: number | null;
  like_count: number | null;
  studio?: string | null;
  total_episodes?: number | null;
  is_eng_dub?: boolean | null;
}

interface MoreInfoDrawerProps {
  anime: MoreInfoAnime;
  totalSeasons?: number;
  totalAvailableEpisodes?: number;
  className?: string;
}

/**
 * Rich "More info" drawer — slide-in liquid-glass panel with full metadata,
 * studio, dub type, stats, tags. Non-blocking; keeps the hero uncluttered.
 */
export function MoreInfoDrawer({
  anime,
  totalSeasons,
  totalAvailableEpisodes,
  className,
}: MoreInfoDrawerProps) {
  const dub = anime.is_eng_dub ? 'English Dub' : 'Hindi Dub';
  const formatCount = (n: number | null | undefined) => {
    if (!n) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const stats = [
    { icon: Eye, label: 'Views', value: formatViews(getViewCount(anime.title, anime.view_count)) },
    { icon: Heart, label: 'Likes', value: formatLikes(getLikeCount(anime.title, anime.like_count)) },
    { icon: ListVideo, label: 'Episodes', value: totalAvailableEpisodes ?? anime.total_episodes ?? '—' },
    { icon: Tv, label: 'Seasons', value: totalSeasons ?? '—' },
  ];

  const facts: [string, string | number | null | undefined][] = [
    ['Type', anime.type],
    ['Status', anime.status],
    ['Studio', anime.studio],
    ['Released', anime.release_year],
    ['Audio', dub],
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-11 md:h-14 px-4 md:px-5 rounded-xl border border-foreground/20 bg-foreground/5 backdrop-blur-md hover:border-primary/40 hover:text-primary text-xs md:text-sm ${className || ''}`}
        >
          <Info className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
          More info
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 border-l border-white/10 overflow-hidden"
      >
        {/* Blurred backdrop */}
        <div className="absolute inset-0 -z-10">
          {anime.banner_image || anime.cover_image ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${anime.banner_image || anime.cover_image})`,
                filter: 'blur(40px) brightness(0.35) saturate(1.3)',
                transform: 'scale(1.2)',
              }}
            />
          ) : null}
          <div className="absolute inset-0 bg-background/70" />
        </div>

        <div className="h-full overflow-y-auto overscroll-contain pb-10">
          {/* Cover strip */}
          <div className="relative">
            <div
              className="h-40 bg-cover bg-center"
              style={{
                backgroundImage: `url(${anime.banner_image || anime.cover_image || '/placeholder.svg'})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>

          <div className="px-5 pt-4 -mt-16 relative">
            <div className="flex gap-4 items-end">
              <img
                src={anime.cover_image || '/placeholder.svg'}
                alt={anime.title}
                className="w-24 h-32 rounded-lg border border-white/10 shadow-2xl object-cover"
              />
              <div className="pb-1">
                <SheetHeader className="text-left space-y-1">
                  <SheetTitle className="text-xl leading-tight line-clamp-2">
                    {anime.title}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {anime.type && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary">
                      {anime.type}
                    </span>
                  )}
                  {anime.status && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                      {anime.status}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      anime.is_eng_dub
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white'
                        : 'bg-amber-500/15 border border-amber-400/30 text-amber-300'
                    }`}
                  >
                    {anime.is_eng_dub ? 'E-DUB' : 'H-DUB'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 mt-6 space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {stats.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-2 py-3 text-center"
                >
                  <Icon className="h-3.5 w-3.5 text-primary mx-auto mb-1.5" />
                  <div className="text-sm font-bold leading-none">{value}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* Synopsis */}
            {anime.description && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Synopsis
                </h3>
                <p className="text-sm leading-relaxed text-foreground/85">
                  {anime.description}
                </p>
              </section>
            )}

            {/* Facts table */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-primary" />
                Details
              </h3>
              <dl className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <dt className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                      {k}
                    </dt>
                    <dd className="text-foreground/90 font-medium capitalize text-right max-w-[60%] truncate">
                      {v ?? '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-amber-400" />
                  Genres & Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {anime.genres.map((g) => (
                    <Badge
                      key={g}
                      className="text-[10px] px-2.5 py-1 rounded-full border border-foreground/15 bg-foreground/5 backdrop-blur-md text-foreground/85 hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      {g}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
