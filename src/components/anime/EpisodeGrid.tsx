import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EpisodeGridItem {
  id: string;
  episode_number: number;
  title: string;
  thumbnail: string | null;
  duration: number | null;
}

interface EpisodeGridProps {
  episodes: EpisodeGridItem[];
  fallbackImage?: string | null;
  getProgress: (id: string) => number;
  isCompleted: (id: string) => boolean;
  onToggleWatched: (id: string, e: React.MouseEvent) => void;
}

const formatDuration = (m: number | null) => (m ? `${m} min` : '');

/**
 * Refined episode grid — memoized cards, cleaner hierarchy, subtle motion.
 * Layout: 2 cols mobile / 3 sm / 4 lg / 5 xl.
 */
function EpisodeCardImpl({
  ep,
  fallbackImage,
  progress,
  completed,
  onToggleWatched,
  index,
}: {
  ep: EpisodeGridItem;
  fallbackImage?: string | null;
  progress: number;
  completed: boolean;
  onToggleWatched: (id: string, e: React.MouseEvent) => void;
  index: number;
}) {
  return (
    <Link
      to={`/watch/${ep.id}`}
      className="group relative rounded-xl overflow-hidden border border-border/40 bg-card/60 backdrop-blur-sm hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-300 animate-fade-in shadow-sm hover:shadow-lg hover:shadow-primary/10"
      style={{ animationDelay: `${Math.min(index * 25, 400)}ms` }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={ep.thumbnail || fallbackImage || '/placeholder.svg'}
          alt={ep.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* Play hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
          <div className="w-11 h-11 rounded-full bg-primary/95 flex items-center justify-center shadow-xl shadow-primary/40 scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>

        {/* EP + duration bottom row */}
        <div className="absolute inset-x-0 bottom-0 p-2 flex items-end justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/85 text-primary-foreground shadow">
            EP {ep.episode_number}
          </span>
          {ep.duration && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white/90 backdrop-blur-sm">
              {formatDuration(ep.duration)}
            </span>
          )}
        </div>

        {/* 4K corner */}
        <div className="absolute top-1.5 right-1.5 z-10">
          <span className="text-[8px] font-black px-1 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow">
            4K
          </span>
        </div>

        {/* Completed */}
        {completed && (
          <div className="absolute top-1.5 left-1.5 p-1 bg-emerald-500/90 rounded-full shadow">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Toggle watched */}
        <button
          onClick={(e) => onToggleWatched(ep.id, e)}
          className={cn(
            'absolute top-1.5 z-10 p-1 rounded-full bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition',
            completed ? 'left-8' : 'left-1.5'
          )}
          title={completed ? 'Mark as unwatched' : 'Mark as watched'}
          aria-label={completed ? 'Mark as unwatched' : 'Mark as watched'}
        >
          {completed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>

        {/* Progress */}
        {progress > 0 && !completed && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/60">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-2.5">
        <h3 className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {ep.title}
        </h3>
        {progress > 0 && !completed && (
          <p className="text-[10px] text-muted-foreground mt-1">{Math.round(progress)}% watched</p>
        )}
      </div>
    </Link>
  );
}

const EpisodeCard = memo(EpisodeCardImpl, (prev, next) =>
  prev.ep.id === next.ep.id &&
  prev.progress === next.progress &&
  prev.completed === next.completed &&
  prev.fallbackImage === next.fallbackImage
);

export const EpisodeGrid = memo(function EpisodeGrid({
  episodes,
  fallbackImage,
  getProgress,
  isCompleted,
  onToggleWatched,
}: EpisodeGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {episodes.map((ep, i) => (
        <EpisodeCard
          key={ep.id}
          ep={ep}
          index={i}
          fallbackImage={fallbackImage}
          progress={getProgress(ep.id)}
          completed={isCompleted(ep.id)}
          onToggleWatched={onToggleWatched}
        />
      ))}
    </div>
  );
});
