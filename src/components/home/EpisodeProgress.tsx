import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';

interface NoEpisodesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  animeTitle: string;
}

function NoEpisodesPopup({ isOpen, onClose, animeTitle }: NoEpisodesPopupProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-xl animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Episodes Coming Soon</h3>
          </div>
        </div>
        <p className="text-muted-foreground mb-6">
          The episodes for "<span className="text-foreground font-medium">{animeTitle}</span>" are currently under progress. Please check back later!
        </p>
        <Button 
          onClick={onClose}
          className="w-full anime-button"
        >
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
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string }>({
    isOpen: false,
    animeTitle: '',
  });

  useEffect(() => {
    fetchAnimeWithoutEpisodes();
  }, []);

  const fetchAnimeWithoutEpisodes = async () => {
    try {
      // Optimized query: Fetch all anime with their episode counts in a single query
      const { data: allAnime, error: animeError } = await supabase
        .from('anime')
        .select('id, title, cover_image, created_at, type, status')
        .neq('status', 'upcoming') // Exclude upcoming anime (they go to Coming Soon)
        .order('created_at', { ascending: false });

      if (animeError) {
        console.error('Error fetching anime:', animeError);
        setIsLoading(false);
        return;
      }

      // Fetch all seasons and episodes counts in batch
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, anime_id');

      const seasonIds = seasons?.map(s => s.id) || [];
      
      // Get episode counts per season in one query
      const { data: episodeCounts } = await supabase
        .from('episodes')
        .select('season_id')
        .in('season_id', seasonIds.length > 0 ? seasonIds : ['no-match']);

      // Create a map of anime_id to episode count
      const animeEpisodeMap = new Map<string, number>();
      if (seasons && episodeCounts) {
        const seasonToAnime = new Map(seasons.map(s => [s.id, s.anime_id]));
        episodeCounts.forEach(ep => {
          const animeId = seasonToAnime.get(ep.season_id);
          if (animeId) {
            animeEpisodeMap.set(animeId, (animeEpisodeMap.get(animeId) || 0) + 1);
          }
        });
      }

      // Filter anime without episodes
      const animeWithoutEpisodes = (allAnime || []).filter(anime => {
        const episodeCount = animeEpisodeMap.get(anime.id) || 0;
        return episodeCount === 0;
      });

      setAnimeList(animeWithoutEpisodes.slice(0, 8));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnimeClick = (anime: AnimeWithoutEpisodes, e: React.MouseEvent) => {
    e.preventDefault();
    setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title });
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
      />
      
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl md:text-2xl font-heading font-bold">Pending Upload</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/browse?filter=no-episodes" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              See All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="flex md:grid md:grid-cols-4 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
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
