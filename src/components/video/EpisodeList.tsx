import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Play, Clock, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface Episode {
  id: string;
  episode_number: number;
  title: string;
}

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisodeId: string;
  className?: string;
  onEpisodeSelect?: (episodeId: string) => void;
  animeTitle?: string;
  seasonNumber?: number;
}

export function EpisodeList({ episodes, currentEpisodeId, className, onEpisodeSelect, animeTitle, seasonNumber = 1 }: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return episodes;
    const query = searchQuery.toLowerCase();
    return episodes.filter(ep => 
      ep.title.toLowerCase().includes(query) ||
      ep.episode_number.toString().includes(query)
    );
  }, [episodes, searchQuery]);

  const handleAddToWatchLater = async (e: React.MouseEvent, episodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Please sign in to use Watch Later');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('watch_later')
        .select('id')
        .eq('user_id', user.id)
        .eq('episode_id', episodeId)
        .maybeSingle();

      if (existing) {
        toast.info('Already in Watch Later');
        return;
      }

      const { error } = await supabase
        .from('watch_later')
        .insert({
          user_id: user.id,
          episode_id: episodeId
        });

      if (error) throw error;
      toast.success('Added to Watch Later');
    } catch (error) {
      console.error('Error adding to watch later:', error);
      toast.error('Failed to add to Watch Later');
    }
  };

  const handleEpisodeClick = (e: React.MouseEvent, episodeId: string) => {
    if (onEpisodeSelect) {
      e.preventDefault();
      onEpisodeSelect(episodeId);
    }
  };

  const copyEmbedLink = (episode: Episode) => {
    const slug = animeTitle
      ? animeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : 'anime';
    const embedUrl = `${window.location.origin}/embed/${slug}/episode-${episode.episode_number}`;
    navigator.clipboard.writeText(embedUrl);
    toast.success('Embed link copied!');
  };

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

      {/* Episode list */}
      <ScrollArea className="flex-1 max-h-[40vh] md:max-h-none overflow-y-auto touch-pan-y">
        <div className="p-1">
          {filteredEpisodes.map((episode) => {
            const isActive = episode.id === currentEpisodeId;
            return (
              <ContextMenu key={episode.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-xs group",
                      isActive 
                        ? "bg-primary/20 text-primary" 
                        : "hover:bg-muted/50 text-foreground/80 hover:text-foreground"
                    )}
                  >
                    <Link
                      to={`/watch/${episode.id}`}
                      onClick={(e) => handleEpisodeClick(e, episode.id)}
                      className="flex items-center gap-2 flex-1 min-w-0"
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
                    {/* Watch Later button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => handleAddToWatchLater(e, episode.id)}
                      title="Add to Watch Later"
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => copyEmbedLink(episode)} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Copy embed link
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
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
