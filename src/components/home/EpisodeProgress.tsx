import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ChevronRight, AlertCircle, Upload, Bell, Calendar, Info } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';

interface NoEpisodesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  animeTitle: string;
  animeType?: string | null;
  animeStatus?: string | null;
  createdAt?: string;
}

function NoEpisodesPopup({ isOpen, onClose, animeTitle, animeType, animeStatus, createdAt }: NoEpisodesPopupProps) {
  if (!isOpen) return null;

  const addedDate = createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const daysSinceAdded = createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md mx-4 shadow-2xl animate-scale-in">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Clock className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Episodes Under Progress</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Content is being prepared</p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 mb-4 border border-border/50">
          <p className="text-sm text-foreground font-medium mb-1">{animeTitle}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {animeType && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">{animeType}</span>
            )}
            {animeStatus && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase">{animeStatus}</span>
            )}
            {addedDate && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Added {addedDate}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-3">
            <Upload className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Our team is currently <span className="text-foreground font-medium">encoding and uploading</span> the episodes. This includes multi-audio processing, quality optimization, and subtitle integration.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {daysSinceAdded !== null && daysSinceAdded <= 3
                ? 'This anime was recently added. Episodes are expected within the next few days.'
                : 'Episodes are in the upload queue. Complex anime with multiple audio tracks may take longer to process.'}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Bell className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Join our <a href="https://t.me/AnimeSaviInhindiDUB" target="_blank" rel="noopener noreferrer" className="text-primary underline">Telegram channel</a> for instant notifications when episodes go live.
            </p>
          </div>
        </div>

        <Button onClick={onClose} className="w-full anime-button">
          OK, Got It!
        </Button>
      </div>
    </div>
  );
}

interface AnimeWithoutEpisodes {
  id: string;
  title: string;
  cover_image: string | null;
  created_at: string;
  type: string | null;
  status: string | null;
}

export function EpisodeProgress() {
  const [animeList, setAnimeList] = useState<AnimeWithoutEpisodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string; animeType?: string | null; animeStatus?: string | null; createdAt?: string }>({
    isOpen: false,
    animeTitle: '',
  });

  useEffect(() => {
    fetchAnimeWithoutEpisodes();
  }, []);

  // Auto-refresh when episodes or anime change
  useEffect(() => {
    const channel = supabase
      .channel('home-pending-episodes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, () => {
        fetchAnimeWithoutEpisodes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anime' }, () => {
        fetchAnimeWithoutEpisodes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAnimeWithoutEpisodes = async () => {
    try {
      const { data: allAnime, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, created_at, type, status')
        .neq('status', 'upcoming')
        .order('created_at', { ascending: false });

      if (animeError) {
        console.error('Error fetching anime:', animeError);
        setIsLoading(false);
        return;
      }

      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, anime_id');

      const seasonIds = seasons?.map(s => s.id) || [];
      const seasonToAnime = new Map((seasons || []).map(s => [s.id, s.anime_id]));
      const animeWithEpisodes = new Set<string>();

      if (seasonIds.length > 0) {
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data: episodeBatch } = await supabase
            .from('episodes')
            .select('season_id')
            .in('season_id', seasonIds)
            .range(offset, offset + pageSize - 1);
          
          (episodeBatch || []).forEach(ep => {
            const animeId = seasonToAnime.get(ep.season_id);
            if (animeId) animeWithEpisodes.add(animeId);
          });
          
          hasMore = (episodeBatch?.length || 0) === pageSize;
          offset += pageSize;
        }
      }

      const animeWithoutEpisodes = (allAnime || []).filter(anime => !animeWithEpisodes.has(anime.id));

      setAnimeList(animeWithoutEpisodes.slice(0, 8));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnimeClick = (anime: AnimeWithoutEpisodes, e: React.MouseEvent) => {
    e.preventDefault();
    setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title, animeType: anime.type, animeStatus: anime.status, createdAt: anime.created_at });
  };

  if (!isLoading && animeList.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      {/* No Episodes Popup */}
      <NoEpisodesPopup
        isOpen={noEpisodesPopup.isOpen}
        onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })}
        animeTitle={noEpisodesPopup.animeTitle}
        animeType={noEpisodesPopup.animeType}
        animeStatus={noEpisodesPopup.animeStatus}
        createdAt={noEpisodesPopup.createdAt}
      />
      
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl md:text-2xl font-heading font-bold">Pending Upload</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pending-upload" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible snap-row">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="anime-card-uniform space-y-2 shrink-0">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : (
          animeList.map((anime) => (
              <AnimeCardContextMenu 
                key={anime.id} 
                animeTitle={anime.title}
                animeUrl={`/anime/${anime.id}`}
                coverImage={anime.cover_image}
              >
                <div
                  onClick={(e) => handleAnimeClick(anime, e)}
                  className="group relative anime-card-uniform shrink-0 cursor-pointer"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                    {anime.cover_image ? (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    
                    {/* Episodes Under Progress Badge */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center px-3">
                        <Clock className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                        <span className="text-white text-xs font-medium leading-tight block">
                          Episodes Under Progress
                        </span>
                      </div>
                    </div>

                    {/* Type badge */}
                    {anime.type && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">
                        {anime.type}
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                </div>
              </AnimeCardContextMenu>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
