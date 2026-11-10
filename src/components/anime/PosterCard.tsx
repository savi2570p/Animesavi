import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Layers, Play } from 'lucide-react';
import { DubBadge } from '@/components/anime/DubBadge';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { cn } from '@/lib/utils';

export interface PosterCardProps {
  to: string;
  title: string;
  cover: string | null | undefined;
  isEngDub?: boolean | null;
  isSubOnly?: boolean | null;
  genres?: string[] | null;
  contentRating?: string | null;
  episodes?: number | null;
  views?: string | null;
  type?: string | null;
  year?: number | string | null;
  status?: string | null;
  /** Small leading chip, e.g. a rank "01" or "NEW". */
  tag?: string | null;
  /** Shows the "Under Progress" overlay when no episodes are uploaded yet. */
  pending?: boolean;
  /** Fill the grid column instead of using the fixed row width. */
  fluid?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const TYPE_LABEL: Record<string, string> = { series: 'TV', movie: 'MOVIE', ova: 'OVA', ona: 'ONA', special: 'SPECIAL' };

/** Re:ANIME-style poster card shared by every catalogue surface. */
export const PosterCard = memo(function PosterCard({
  to, title, cover, isEngDub, isSubOnly, genres, contentRating, episodes, views,
  type, year, status, tag, pending = false, fluid = false, className, onClick,
}: PosterCardProps) {
  const img = cover || '/placeholder.svg';
  const typeLabel = type ? (TYPE_LABEL[type.toLowerCase()] ?? type.toUpperCase()) : null;
  const meta = [typeLabel, year].filter(Boolean).join(' · ');
  const live = status === 'ongoing';
  return (
    <Link to={to} onClick={onClick} className={cn('poster-card group', fluid ? 'w-full' : 'poster-card-fixed shrink-0', className)}>
      <div className="poster-card-art">
        <img src={img} alt="" aria-hidden className="catalogue-fill perf-blur-fill absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <img src={img} alt={title} className="relative h-full w-full object-contain" loading="lazy" decoding="async" />
        <div className="poster-card-top">
          {tag && <span className="poster-card-chip poster-card-chip-accent">{tag}</span>}
          <DubBadge isEngDub={isEngDub} isSubOnly={isSubOnly} genres={genres} />
          {contentRating && <span className="poster-card-chip">{contentRating}</span>}
        </div>
        {(episodes != null || views) && !pending && (
          <div className="poster-card-bottom">
            {episodes != null && <span className="poster-card-chip"><Layers aria-hidden />{episodes}</span>}
            {views && <span className="poster-card-chip"><Eye aria-hidden />{views}</span>}
          </div>
        )}
        {pending ? (
          <div className="poster-card-pending"><span>Under Progress</span></div>
        ) : (
          <span className="poster-card-play" aria-hidden><Play className="fill-current" /></span>
        )}
        <TokenCrownBadge />
      </div>
      <p className="poster-card-title">
        <span className="poster-card-dot" data-live={live || undefined} aria-hidden />
        <span className="truncate">{title}</span>
      </p>
      {meta && <p className="poster-card-meta">{meta}</p>}
    </Link>
  );
});
