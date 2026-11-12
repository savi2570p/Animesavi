import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface SeasonCardItem {
  id: string;
  season_number: number;
  title: string | null;
  episode_count?: number;
}

interface SeasonCardsProps {
  seasons: SeasonCardItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  /** Series title used when a season has no title of its own. */
  animeTitle?: string;
  /** Series artwork; seasons have no artwork of their own. */
  artwork?: string | null;
  type?: string | null;
  year?: number | null;
  heading?: string;
  className?: string;
}

const typeLabel = (type?: string | null) => {
  if (!type) return 'TV';
  const t = type.toLowerCase();
  if (t === 'movie') return 'Movie';
  if (t === 'tv' || t === 'series' || t === 'tv series') return 'TV';
  return type.toUpperCase();
};

/**
 * Compact Re:ANIME-style season cards shared by the anime detail and Watch pages.
 * Presentation only — selection goes through each page's existing season handler.
 */
export const SeasonCards = memo(function SeasonCards({
  seasons, activeId, onSelect, animeTitle, artwork, type, year, heading = 'Seasons', className,
}: SeasonCardsProps) {
  if (!seasons.length) return null;
  const meta = [typeLabel(type), year].filter(Boolean).join(' • ');

  return (
    <section aria-label={heading} className={cn('season-cards', className)}>
      <h2 className="season-cards-heading">{heading}</h2>
      <div className="snap-row season-cards-row">
        {seasons.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
              aria-label={`Season ${s.season_number}${s.title ? `: ${s.title}` : ''}`}
              className="season-card"
            >
              {artwork && <img src={artwork} alt="" loading="lazy" decoding="async" />}
              <span className="season-card-copy">
                <span className="season-card-label">Season {s.season_number}</span>
                <span className="season-card-title">{s.title || animeTitle}</span>
                <span className="season-card-meta">
                  {meta}
                  {s.episode_count ? ` • ${s.episode_count} eps` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
