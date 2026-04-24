import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Play, Clock, Link2, ListVideo, X, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  audio_language?: string | null;
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
  const [sortAsc, setSortAsc] = useState(true);
  const { user } = useAuth();
  const activeRef = useRef<HTMLDivElement | null>(null);

  const currentIndex = useMemo(
    () => episodes.findIndex(e => e.id === currentEpisodeId),
    [episodes, currentEpisodeId]
  );
  const currentEpisode = currentIndex >= 0 ? episodes[currentIndex] : null;

  const filteredEpisodes = useMemo(() => {
    let list = episodes;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(ep =>
        ep.title.toLowerCase().includes(query) ||
        ep.episode_number.toString().includes(query)
      );
    }
    return [...list].sort((a, b) =>
      sortAsc ? a.episode_number - b.episode_number : b.episode_number - a.episode_number
    );
  }, [episodes, searchQuery, sortAsc]);

  // Auto-scroll active episode into view
  useEffect(() => {
    const t = setTimeout(() => {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 200);
    return () => clearTimeout(t);
  }, [currentEpisodeId, sortAsc]);

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
        .insert({ user_id: user.id, episode_id: episodeId });

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
    const embedUrl = `${window.location.origin}/embed/${slug}/season-${seasonNumber}/episode-${episode.episode_number}`;
    navigator.clipboard.writeText(embedUrl);
    toast.success('Embed link copied!');
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-gradient-to-b from-card/95 to-card/80 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden shadow-lg shadow-black/20",
        className
      )}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ListVideo className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Episodes</p>
              {currentEpisode && (
                <p className="text-[10px] text-muted-foreground truncate">
                  Now: EP {currentEpisode.episode_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-medium bg-secondary/60 border-border/50"
            >
              {episodes.length} EP
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setSortAsc(s => !s)}
              title={sortAsc ? 'Sort: Newest first' : 'Sort: Oldest first'}
            >
              {sortAsc ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="Search episode number or title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-secondary/40 border-border/40 focus-visible:ring-primary/40 placeholder:text-muted-foreground/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Episode list */}
      <ScrollArea className="flex-1 max-h-[42vh] md:max-h-[calc(100vh-280px)] overflow-y-auto touch-pan-y">
        <div className="p-1.5 space-y-0.5">
          {filteredEpisodes.map((episode) => {
            const isActive = episode.id === currentEpisodeId;
            return (
              <ContextMenu key={episode.id}>
                <ContextMenuTrigger asChild>
                  <div
                    ref={isActive ? activeRef : undefined}
                    className={cn(
                      "relative flex items-center gap-2 pl-2 pr-1.5 py-2 rounded-lg transition-all duration-200 text-xs group cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-primary ring-1 ring-primary/40 shadow-sm shadow-primary/10"
                        : "hover:bg-muted/40 text-foreground/85 hover:text-foreground"
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
                    )}

                    <Link
                      to={`/watch/${episode.id}`}
                      onClick={(e) => handleEpisodeClick(e, episode.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      {/* Episode number badge */}
                      <div
                        className={cn(
                          "h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/70 text-foreground/70 group-hover:bg-secondary"
                        )}
                      >
                        {isActive ? (
                          <Play className="h-3 w-3 fill-primary-foreground" />
                        ) : (
                          episode.episode_number
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "truncate leading-tight",
                            isActive ? "font-semibold" : "font-medium"
                          )}
                        >
                          {!isActive && (
                            <span className="text-muted-foreground/80 mr-1">EP {episode.episode_number} ·</span>
                          )}
                          {episode.title}
                        </p>
                        {isActive && (
                          <p className="text-[9.5px] text-primary/80 mt-0.5 uppercase tracking-wider font-medium">
                            ● Now Playing
                          </p>
                        )}
                      </div>
                    </Link>

                    {/* Watch Later button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 shrink-0 transition-opacity",
                        "md:opacity-0 md:group-hover:opacity-100",
                        "text-muted-foreground hover:text-primary hover:bg-primary/10"
                      )}
                      onClick={(e) => handleAddToWatchLater(e, episode.id)}
                      title="Add to Watch Later"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => copyEmbedLink(episode)} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Copy embed link
                  </ContextMenuItem>
                  <ContextMenuItem onClick={(e) => handleAddToWatchLater(e as any, episode.id)} className="gap-2">
                    <Clock className="h-4 w-4" />
                    Add to Watch Later
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          {filteredEpisodes.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <Search className="h-5 w-5 mx-auto mb-2 opacity-40" />
              No episodes found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
