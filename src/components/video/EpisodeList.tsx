import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Episode {
  id: string;
  episode_number: number;
  title: string;
}

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisodeId: string;
  className?: string;
}

export function EpisodeList({ episodes, currentEpisodeId, className }: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return episodes;
    const query = searchQuery.toLowerCase();
    return episodes.filter(ep => 
      ep.title.toLowerCase().includes(query) ||
      ep.episode_number.toString().includes(query)
    );
  }, [episodes, searchQuery]);

  return (
    <div className={cn("flex flex-col bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg overflow-hidden", className)}>
      {/* Header with search */}
      <div className="p-3 border-b border-border/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">List of episodes:</span>
          <span className="text-xs text-muted-foreground">{episodes.length} EP</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Number of Ep"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {/* Episode list - height adapts based on episode count, max controlled by parent */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filteredEpisodes.map((episode) => {
            const isActive = episode.id === currentEpisodeId;
            return (
              <Link
                key={episode.id}
                to={`/watch/${episode.id}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-xs",
                  isActive 
                    ? "bg-primary/20 text-primary" 
                    : "hover:bg-muted/50 text-foreground/80 hover:text-foreground"
                )}
              >
                <span className="text-muted-foreground w-5 text-right shrink-0 text-[10px]">
                  {episode.episode_number}
                </span>
                <span className="flex-1 truncate">
                  {episode.title}
                </span>
                {isActive && (
                  <Play className="h-3 w-3 text-primary fill-primary shrink-0" />
                )}
              </Link>
            );
          })}
          {filteredEpisodes.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No episodes found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}