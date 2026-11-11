import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Play, LayoutGrid, List, X, ChevronRight, ListVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WmEpisode {
  id: string;
  episode_number: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  created_at?: string | null;
}

interface WmSeason {
  id: string;
  season_number: number;
  title: string | null;
  episode_count?: number;
}

interface WmAnime {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image?: string | null;
  type?: string | null;
  description?: string | null;
  genres?: string[] | null;
  status?: string | null;
  release_year?: number | null;
  studio?: string | null;
  total_episodes?: number | null;
}

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : '';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Phone/tablet watch sections below the player (Re:ANIME-style):
 * season cards, a searchable episode list with thumbnails, and an About Anime card.
 * Presentation only — episode and season changes go through the page's existing handlers.
 */
export const MobileWatchEpisodes = memo(function MobileWatchEpisodes({
  anime, seasons, currentSeasonId, onSeasonChange, episodes, currentEpisodeId, onEpisodeSelect,
}: {
  anime: WmAnime | null;
  seasons: WmSeason[];
  currentSeasonId?: string;
  onSeasonChange: (id: string) => void;
  episodes: WmEpisode[];
  currentEpisodeId: string;
  onEpisodeSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fallback = anime?.banner_image || anime?.cover_image || '/placeholder.svg';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((ep) => ep.title.toLowerCase().includes(q) || String(ep.episode_number).includes(q));
  }, [episodes, query]);

  // Keep the playing episode visible inside the list without scrolling the page.
  useEffect(() => {
    const box = scrollRef.current;
    const active = box?.querySelector<HTMLElement>('[data-active="true"]');
    if (!box || !active) return;
    box.scrollTop = Math.max(0, active.offsetTop - box.offsetTop - 8);
  }, [currentEpisodeId, view, episodes.length]);

  return (
    <div className="wm-sections">
      {seasons.length > 1 && (
        <section aria-label="Seasons">
          <h2 className="wm-eyebrow">Watch more seasons of this anime</h2>
          <div className="snap-row wm-season-row">
            {seasons.map((s) => {
              const active = s.id === currentSeasonId;
              return (
                <button key={s.id} type="button" onClick={() => onSeasonChange(s.id)} aria-pressed={active} className="wm-season-card">
                  <img src={fallback} alt="" loading="lazy" decoding="async" />
                  <span className="wm-season-copy">
                    <span className="wm-season-label">Season {s.season_number}</span>
                    <span className="wm-season-title">{s.title || anime?.title}</span>
                    {s.episode_count != null && <span className="wm-season-meta">{s.episode_count} episodes</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Episodes">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="wm-title">Episodes <span className="wm-count">{episodes.length}</span></h2>
          <div className="wm-toggle" role="group" aria-label="Episode view">
            <button type="button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}><List /></button>
            <button type="button" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setView('grid')}><LayoutGrid /></button>
          </div>
        </div>
        <div className="wm-search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search episodes..." aria-label="Search episodes" />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X /></button>
          ) : <Search aria-hidden />}
        </div>

        <div ref={scrollRef} className={cn('wm-episodes', view === 'grid' && 'is-grid')}>
          {filtered.map((ep) => {
            const active = ep.id === currentEpisodeId;
            return (
              <Link
                key={ep.id}
                to={`/watch/${ep.id}`}
                data-active={active}
                aria-current={active ? 'true' : undefined}
                onClick={(e) => { e.preventDefault(); if (!active) onEpisodeSelect(ep.id); }}
                className="wm-episode"
              >
                <span className="wm-thumb">
                  <img src={ep.thumbnail || fallback} alt="" loading="lazy" decoding="async" />
                  {active && <span className="wm-play"><Play /></span>}
                  {view === 'grid' && <span className="wm-thumb-ep">EP {ep.episode_number}</span>}
                </span>
                <span className="wm-episode-copy">
                  <span className="wm-episode-title"><span>{pad(ep.episode_number)}.</span> {ep.title}</span>
                  {view === 'list' && <span className="wm-episode-desc">{ep.description || 'No synopsis yet.'}</span>}
                  {view === 'list' && ep.created_at && <span className="wm-episode-date">{formatDate(ep.created_at)}</span>}
                </span>
              </Link>
            );
          })}
          {filtered.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No episodes found</p>}
        </div>
      </section>
    </div>
  );
});

export const MobileAboutAnime = memo(function MobileAboutAnime({ anime, episodeCount }: { anime: WmAnime | null; episodeCount: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!anime) return null;
  const status = anime.status === 'ongoing' ? 'Releasing' : anime.status === 'completed' ? 'Finished' : anime.status === 'upcoming' ? 'Upcoming' : anime.status;
  const rows: Array<[string, string | null | undefined]> = [
    ['Studio', anime.studio],
    ['Aired', anime.release_year ? String(anime.release_year) : null],
    ['Genres', anime.genres?.length ? anime.genres.slice(0, 6).join(', ') : null],
  ];

  return (
    <section aria-label="About anime" className="wm-about">
      <h2 className="wm-title mb-3">About Anime</h2>
      <div className="wm-about-card">
        <div className="flex gap-3.5">
          <Link to={`/anime/${anime.id}`} className="wm-about-poster">
            <img src={anime.cover_image || '/placeholder.svg'} alt={`${anime.title} poster`} loading="lazy" decoding="async" />
          </Link>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-bold text-base leading-snug line-clamp-2">{anime.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="wm-chip"><ListVideo />{anime.total_episodes || episodeCount}</span>
              {status && <span className="wm-chip is-accent">{status}</span>}
              {anime.type && <span className="wm-chip">{anime.type === 'movie' ? 'Movie' : 'TV'}</span>}
            </div>
            {anime.description && (
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <p className={expanded ? '' : 'line-clamp-4'}>{anime.description}</p>
                {anime.description.length > 160 && (
                  <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11px] font-semibold text-primary">
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {rows.some(([, v]) => v) && (
          <dl className="wm-about-rows">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt>{k}:</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}

        <Link to={`/anime/${anime.id}`} className="wm-about-cta">View details <ChevronRight /></Link>
      </div>
    </section>
  );
});
