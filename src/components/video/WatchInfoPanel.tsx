import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ListVideo } from 'lucide-react';
import { DubBadge } from '@/components/anime/DubBadge';

interface WatchInfoAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  description?: string | null;
  genres?: string[] | null;
  status?: string | null;
  release_year?: number | null;
  studio?: string | null;
  total_episodes?: number | null;
  source_material?: string | null;
  content_rating?: string | null;
  is_sub_only?: boolean | null;
  is_eng_dub?: boolean | null;
}

interface WatchInfoPanelProps {
  anime: WatchInfoAnime | null;
  episodeNumber: number;
  seasonNumber: number;
  episodeCount: number;
}

/**
 * Desktop-only details column beside the player (Re:ANIME-style).
 * Pure presentation: reads the anime record the watch page already loaded.
 */
export const WatchInfoPanel = memo(function WatchInfoPanel({ anime, episodeNumber, seasonNumber, episodeCount }: WatchInfoPanelProps) {
  const [expanded, setExpanded] = useState(false);
  if (!anime) return <aside className="watch-info-panel hidden xl:block" aria-hidden />;

  const status = anime.status ? anime.status.charAt(0).toUpperCase() + anime.status.slice(1) : null;
  const rows: Array<[string, string | null | undefined]> = [
    ['Type', anime.type ? anime.type.charAt(0).toUpperCase() + anime.type.slice(1) : null],
    ['Released', anime.release_year ? String(anime.release_year) : null],
    ['Studio', anime.studio],
    ['Source', anime.source_material],
    ['Rating', anime.content_rating],
    ['Now', `Season ${seasonNumber} · Episode ${episodeNumber}`],
  ];

  return (
    <aside className="watch-info-panel hidden xl:flex flex-col gap-4 p-4 self-start sticky top-20" aria-label="About this anime">
      <Link to={`/anime/${anime.id}`} className="block mx-auto w-[150px] aspect-[2/3] rounded-md overflow-hidden bg-muted">
        {anime.cover_image && <img src={anime.cover_image} alt={anime.title} className="h-full w-full object-cover" loading="lazy" />}
      </Link>

      <div className="text-center">
        <h2 className="font-heading font-bold text-base leading-snug line-clamp-3">{anime.title}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
          <span className="watch-info-chip inline-flex items-center gap-1"><ListVideo className="h-3 w-3" />{anime.total_episodes || episodeCount} EP</span>
          {status && <span className="watch-info-chip is-accent">{status}</span>}
          <DubBadge isEngDub={anime.is_eng_dub} isSubOnly={anime.is_sub_only} genres={anime.genres} />
        </div>
      </div>

      {anime.description && (
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className={expanded ? '' : 'line-clamp-4'}>{anime.description}</p>
          {anime.description.length > 180 && (
            <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-primary">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs border-t border-border pt-3">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}:</dt>
            <dd className="text-foreground/90 truncate" title={v || undefined}>{v}</dd>
          </div>
        ))}
      </dl>

      {(anime.genres?.length ?? 0) > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Genres</p>
          <div className="flex flex-wrap gap-1.5">
            {anime.genres!.slice(0, 8).map(g => (
              <Link key={g} to={`/browse?genre=${encodeURIComponent(g)}`} className="watch-info-tag">{g}</Link>
            ))}
          </div>
        </div>
      )}

      <Link to={`/anime/${anime.id}`} className="watch-info-details inline-flex items-center justify-center gap-1.5 h-9 text-[11px] font-semibold uppercase tracking-[0.18em]">
        View details <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
});
