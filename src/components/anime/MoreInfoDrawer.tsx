import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Info, Eye, Heart, ListVideo, Tv } from 'lucide-react';
import { getViewCount, formatViews, getLikeCount, formatLikes } from '@/lib/viewCount';
import { isAdultGenres } from '@/components/anime/DubBadge';

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
  is_sub_only?: boolean | null;
}

interface MoreInfoDrawerProps {
  anime: MoreInfoAnime;
  totalSeasons?: number;
  totalAvailableEpisodes?: number;
  className?: string;
}

const cap = (v: string | null | undefined) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : null);

/**
 * "More info" side panel — flat AnimeSavi+ layout: 16:9 banner, title + chips,
 * one stat strip, expandable synopsis, detail grid and linked genres.
 */
export function MoreInfoDrawer({ anime, totalSeasons, totalAvailableEpisodes, className }: MoreInfoDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const dub = anime.is_sub_only ? 'Japanese (SUB)' : anime.is_eng_dub ? 'English Dub' : 'Hindi Dub';
  const art = anime.banner_image || anime.cover_image || '/placeholder.svg';
  const longSynopsis = (anime.description?.length ?? 0) > 260;

  const stats = [
    { icon: Eye, label: 'Views', value: formatViews(getViewCount(anime.title, anime.view_count)) },
    { icon: Heart, label: 'Likes', value: formatLikes(getLikeCount(anime.title, anime.like_count)) },
    { icon: ListVideo, label: 'Episodes', value: totalAvailableEpisodes ?? anime.total_episodes ?? '—' },
    { icon: Tv, label: 'Seasons', value: totalSeasons ?? '—' },
  ];

  const facts: [string, string | number | null | undefined][] = [
    ['Type', cap(anime.type)],
    ['Status', cap(anime.status)],
    ['Studio', anime.studio],
    ['Released', anime.release_year],
    ['Audio', dub],
    ['Seasons', totalSeasons],
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-11 md:h-14 px-4 md:px-5 rounded-xl border border-foreground/20 bg-foreground/5 hover:border-primary/40 hover:text-primary text-xs md:text-sm ${className || ''}`}
        >
          <Info className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2" />
          More info
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="more-info-v2 w-full sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-contain pb-10">
          <div className="more-info-v2-art">
            <img src={art} alt="" loading="lazy" decoding="async" />
          </div>

          <div className="more-info-v2-body">
            <div className="flex gap-3.5 items-end -mt-12 relative">
              {anime.cover_image && (
                <img src={anime.cover_image} alt="" className="more-info-v2-poster" loading="lazy" decoding="async" />
              )}
              <SheetHeader className="text-left space-y-1 min-w-0 pb-0.5">
                <p className="more-info-v2-eyebrow">About this anime</p>
                <SheetTitle className="more-info-v2-title">{anime.title}</SheetTitle>
                <SheetDescription className="sr-only">Full details for {anime.title}</SheetDescription>
              </SheetHeader>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {anime.type && <span className="more-info-v2-chip is-accent">{anime.type}</span>}
              {anime.status && <span className="more-info-v2-chip">{anime.status}</span>}
              {anime.release_year && <span className="more-info-v2-chip">{anime.release_year}</span>}
              <span className="more-info-v2-chip">{dub}</span>
              {isAdultGenres(anime.genres) && <span className="more-info-v2-chip is-danger">18+</span>}
            </div>

            <dl className="more-info-v2-stats">
              {stats.map(({ icon: Icon, label, value }) => (
                <div key={label}>
                  <dt><Icon aria-hidden />{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {anime.description && (
              <section className="more-info-v2-section">
                <h3>Synopsis</h3>
                <p className={`more-info-v2-synopsis ${expanded ? '' : 'line-clamp-5'}`}>{anime.description}</p>
                {longSynopsis && (
                  <button type="button" className="more-info-v2-more" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </section>
            )}

            <section className="more-info-v2-section">
              <h3>Details</h3>
              <dl className="more-info-v2-facts">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {anime.genres && anime.genres.length > 0 && (
              <section className="more-info-v2-section">
                <h3>Genres</h3>
                <div className="flex flex-wrap gap-1.5">
                  {anime.genres.map((g) => (
                    <Link key={g} to={`/browse?genre=${encodeURIComponent(g.toLowerCase())}`} className="more-info-v2-genre">
                      {g}
                    </Link>
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
