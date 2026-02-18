import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ArrowLeft, AlertCircle, Upload, Lock } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';

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
          className="w-full"
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

export default function PendingUploadPage() {
  const { user, isUploader, isAdmin, isRolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState<AnimeWithoutEpisodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noEpisodesPopup, setNoEpisodesPopup] = useState<{ isOpen: boolean; animeTitle: string }>({
    isOpen: false,
    animeTitle: '',
  });

  const canAccess = isUploader || isAdmin;

  useEffect(() => {
    if (isRolesLoaded && !canAccess) {
      return;
    }
    if (isRolesLoaded) {
      fetchAnimeWithoutEpisodes();
    }
  }, [isRolesLoaded, canAccess]);

  // Subscribe to episode changes to auto-refresh the pending list
  useEffect(() => {
    if (!isRolesLoaded || !canAccess) return;
    const channel = supabase
      .channel('pending-upload-episodes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'episodes' },
        () => {
          // Refetch whenever episodes are inserted/updated/deleted
          fetchAnimeWithoutEpisodes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'anime' },
        () => {
          fetchAnimeWithoutEpisodes();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isRolesLoaded, canAccess]);

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

      // Instead of fetching all episodes (hits 1000-row limit),
      // fetch distinct season_ids that have episodes using pagination
      const animeWithEpisodes = new Set<string>();
      const seasonToAnime = new Map((seasons || []).map(s => [s.id, s.anime_id]));
      
      if (seasonIds.length > 0) {
        // Paginate through episodes in chunks of 1000 (PostgREST max)
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

      setAnimeList(animeWithoutEpisodes);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnimeClick = (anime: AnimeWithoutEpisodes, e: React.MouseEvent) => {
    e.preventDefault();
    if (canAccess) {
      navigate(`/upload/anime/${anime.id}`);
    } else {
      setNoEpisodesPopup({ isOpen: true, animeTitle: anime.title });
    }
  };

  // Show access denied for non-admins/uploaders
  if (isRolesLoaded && !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">
            This page is only accessible to uploaders and administrators.
          </p>
          <Button asChild>
            <Link to="/browse">Go to Browse</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Content Navigation Tabs */}
      <ContentNavTabs />
      
      <NoEpisodesPopup
        isOpen={noEpisodesPopup.isOpen}
        onClose={() => setNoEpisodesPopup({ isOpen: false, animeTitle: '' })}
        animeTitle={noEpisodesPopup.animeTitle}
      />
      
      {/* Hero Header */}
      <div className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        
        <div className="container relative">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold">Pending Upload</h1>
              <p className="text-muted-foreground">Anime entries awaiting episode uploads</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : animeList.length === 0 ? (
          <div className="text-center py-16">
            <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground mb-6">No anime entries are pending episode uploads.</p>
            <Button asChild>
              <Link to="/upload">Upload New Anime</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => (
              <AnimeCardContextMenu 
                key={anime.id} 
                animeTitle={anime.title}
                animeUrl={`/anime/${anime.id}`}
                coverImage={anime.cover_image}
              >
                <div
                  onClick={(e) => handleAnimeClick(anime, e)}
                  className="group relative cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
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

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Upload button for uploaders */}
                    {canAccess && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="p-3 rounded-full bg-primary/90 shadow-lg">
                          <Upload className="h-5 w-5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                </div>
              </AnimeCardContextMenu>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
