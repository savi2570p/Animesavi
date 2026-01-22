import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Play, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface WatchLaterItem {
  id: string;
  episode_id: string;
  created_at: string;
  episode?: {
    id: string;
    title: string;
    episode_number: number;
    thumbnail: string | null;
    season?: {
      season_number: number;
      anime?: {
        id: string;
        title: string;
        cover_image: string | null;
      };
    };
  };
}

export function WatchLaterButton() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWatchLater();
    }
  }, [user]);

  const fetchWatchLater = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('watch_later')
      .select(`
        id,
        episode_id,
        created_at,
        episode:episodes(
          id,
          title,
          episode_number,
          thumbnail,
          season:season_id(
            season_number,
            anime:anime_id(
              id,
              title,
              cover_image
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setItems(data as unknown as WatchLaterItem[]);
    }
  };

  const removeFromWatchLater = async (id: string) => {
    const { error } = await supabase
      .from('watch_later')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to remove from Watch Later');
    } else {
      setItems(items.filter(item => item.id !== id));
      toast.success('Removed from Watch Later');
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Clock className="h-5 w-5" />
          {items.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center">
              {items.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-card border-border" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Watch Later
          </span>
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No episodes saved for later
            </div>
          ) : (
            items.map((item) => {
              const episode = item.episode;
              const anime = episode?.season?.anime;
              
              return (
                <div key={item.id} className="p-2 border-b border-border/50 last:border-0">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <Link 
                      to={`/watch/${episode?.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex-shrink-0"
                    >
                      <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                        <img
                          src={episode?.thumbnail || anime?.cover_image || '/placeholder.svg'}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </Link>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/watch/${episode?.id}`}
                        onClick={() => setIsOpen(false)}
                        className="block"
                      >
                        <p className="text-sm font-medium line-clamp-1 hover:text-primary transition-colors">
                          {anime?.title || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          S{episode?.season?.season_number} E{episode?.episode_number}
                        </p>
                      </Link>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                      >
                        <Link to={`/watch/${episode?.id}`} onClick={() => setIsOpen(false)}>
                          <Play className="h-3 w-3" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeFromWatchLater(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
        
        {items.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/history" onClick={() => setIsOpen(false)}>
                  View All History
                </Link>
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook to add/remove from watch later
export function useWatchLater(episodeId: string) {
  const { user } = useAuth();
  const [isInWatchLater, setIsInWatchLater] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && episodeId) {
      checkWatchLater();
    }
  }, [user, episodeId]);

  const checkWatchLater = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('watch_later')
      .select('id')
      .eq('user_id', user.id)
      .eq('episode_id', episodeId)
      .maybeSingle();

    setIsInWatchLater(!!data);
  };

  const toggleWatchLater = async () => {
    if (!user) {
      toast.error('Please sign in to save episodes');
      return;
    }

    setIsLoading(true);

    if (isInWatchLater) {
      const { error } = await supabase
        .from('watch_later')
        .delete()
        .eq('user_id', user.id)
        .eq('episode_id', episodeId);

      if (!error) {
        setIsInWatchLater(false);
        toast.success('Removed from Watch Later');
      }
    } else {
      const { error } = await supabase
        .from('watch_later')
        .insert({
          user_id: user.id,
          episode_id: episodeId,
        });

      if (!error) {
        setIsInWatchLater(true);
        toast.success('Added to Watch Later');
      }
    }

    setIsLoading(false);
  };

  return { isInWatchLater, toggleWatchLater, isLoading };
}
