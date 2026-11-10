import { useState, useEffect } from 'react';
import { PosterCard } from '@/components/anime/PosterCard';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Clock, Star, CalendarClock, Sparkles, Clapperboard } from 'lucide-react';
import { AnimeCardContextMenu } from '@/components/AnimeCardContextMenu';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { SeeAllHeader } from '@/components/layout/SeeAllHeader';
import { DubBadge } from '@/components/anime/DubBadge';

interface Movie {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  release_year: number | null;
  genres: string[] | null;
  created_at: string;
  view_count: number | null;
  status: string | null;
  is_eng_dub?: boolean | null;
  is_sub_only?: boolean | null;
  firstEpisodeId?: string | null;
}

export default function LatestMoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestMovies();
  }, []);

  const fetchLatestMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .eq('type', 'movie')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const moviesWithEpisodes = await Promise.all(
        (data || []).map(async (movie) => {
          const { data: seasons } = await supabase
            .from('seasons')
            .select('id')
            .eq('anime_id', movie.id)
            .order('season_number')
            .limit(1);
          
          if (seasons && seasons.length > 0) {
            const { data: episodes } = await supabase
              .from('episodes')
              .select('id')
              .eq('season_id', seasons[0].id)
              .order('episode_number')
              .limit(1);
            
            return {
              ...movie,
              firstEpisodeId: episodes && episodes.length > 0 ? episodes[0].id : null
            };
          }
          
          return { ...movie, firstEpisodeId: null };
        })
      );
      
      setMovies(moviesWithEpisodes);
    } catch (error) {
      console.error('Error fetching latest movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const isNew = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    return hours <= 24;
  };

  const newCount = movies.filter(m => isNew(m.created_at)).length;
  const upcomingCount = movies.filter(m => m.status === 'upcoming').length;

  return (
    <div className="min-h-screen catalogue-page-v5">
      <ContentNavTabs />

      <SeeAllHeader
        icon={Clapperboard}
        title="Latest Movies"
        subtitle="Cinematic anime films — recently added to the AnimeSavi library."
        eyebrow="Big Screen"
        iconGradient="from-amber-500 via-orange-500 to-rose-500"
        glowTone="bg-amber-500/20"
        stats={[
          { icon: Film, value: movies.length, label: 'Movies', tone: 'text-accent-foreground' },
          { icon: Sparkles, value: newCount, label: 'New 24h', tone: 'text-primary' },
          { icon: CalendarClock, value: upcomingCount, label: 'Upcoming', tone: 'text-accent-foreground' },
        ]}
      />

      <div className="container pb-12">
        {loading ? (
          <div className="browse-ra-grid">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center py-16">
            <Film className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Movies Found</h3>
            <p className="text-muted-foreground">Check back later for new movies.</p>
          </div>
        ) : (
          <div className="browse-ra-grid">
            {movies.map((movie) => (
              <AnimeCardContextMenu
                key={movie.id}
                animeTitle={movie.title}
                animeUrl={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`}
                coverImage={movie.cover_image}
              >
                <PosterCard to={movie.firstEpisodeId ? `/watch/${movie.firstEpisodeId}` : `/anime/${movie.id}`} title={movie.title} cover={movie.cover_image}
                  isEngDub={(movie as any).is_eng_dub} isSubOnly={(movie as any).is_sub_only} genres={(movie as any).genres}
                  type="movie" year={movie.release_year} status={movie.status} tag={isNew(movie.created_at) ? 'NEW' : null} fluid />
              </AnimeCardContextMenu>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
