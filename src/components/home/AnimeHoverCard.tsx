import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Star, Calendar, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimeHoverCardProps {
  id: string;
  title: string;
  coverImage: string | null;
  description?: string | null;
  genres?: string[] | null;
  releaseYear?: number | null;
  type?: string | null;
  episodeCount?: number;
  watchUrl?: string;
  className?: string;
  children?: React.ReactNode;
}

export function AnimeHoverCard({
  id,
  title,
  coverImage,
  description,
  genres,
  releaseYear,
  type,
  episodeCount,
  watchUrl,
  className,
  children,
}: AnimeHoverCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const linkUrl = watchUrl || `/anime/${id}`;

  return (
    <div
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children ? (
        children
      ) : (
        <Link to={linkUrl} className="block">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.03] group-hover:-translate-y-2">
            <img
              src={coverImage || '/placeholder.svg'}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
            
            {/* Hover overlay with info */}
            <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent transition-opacity duration-300",
              isHovered ? "opacity-100" : "opacity-0"
            )}>
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-4 rounded-full bg-primary/90 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 animate-bounce-in">
                  <Play className="h-8 w-8 text-primary-foreground fill-current" />
                </div>
              </div>

              {/* Info overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="text-white font-semibold text-lg line-clamp-1 mb-2">{title}</h3>
                
                {/* Meta info row */}
                <div className="flex items-center gap-3 text-white/80 text-sm mb-2">
                  {releaseYear && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {releaseYear}
                    </span>
                  )}
                  {type && (
                    <span className="px-2 py-0.5 bg-primary/30 rounded text-xs uppercase">
                      {type}
                    </span>
                  )}
                  {episodeCount && episodeCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {episodeCount} eps
                    </span>
                  )}
                </div>

                {/* Description */}
                {description && (
                  <p className="text-white/70 text-xs line-clamp-2 mb-2">
                    {description}
                  </p>
                )}

                {/* Genres */}
                {genres && genres.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {genres.slice(0, 3).map(genre => (
                      <span 
                        key={genre}
                        className="px-2 py-0.5 text-xs bg-white/20 rounded-full text-white/90"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Type badge */}
            {type && (
              <div className="absolute top-2 left-2 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-lg shadow-md">
                {type === 'movie' ? 'Movie' : 'Series'}
              </div>
            )}
          </div>
        </Link>
      )}
    </div>
  );
}
