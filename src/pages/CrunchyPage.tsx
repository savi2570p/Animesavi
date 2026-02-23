import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, Eye } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';

interface CrunchyAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  view_count: number | null;
  episode_count?: number;
  latest_episode_at?: string | null;
}

export default function CrunchyPage() {
  const [animeList, setAnimeList] = useState<CrunchyAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [underProgressAnime, setUnderProgressAnime] = useState<string | null>(null);

  const formatViewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  useEffect(() => {
    const fetchCrunchyAnime = async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, status, view_count')
        .eq('is_crunchyroll', true as any)
        .order('title');

      // Curated view count map (same as MostPopular)
      const viewCountMap: Record<string, number> = {
        'Your Name': 9500000,
        'Your lie in April': 3400000,
        'The angel next door spoils me rotten': 1200000,
        'The Angel Next Door Spoils me Rotten': 1200000,
        'Mechanical Marie': 977000,
        'Solo Leveling': 730000,
        'BOFURI: I Don\'t Want to Get Hurt, so I\'ll Max Out My Defense.': 2300000,
        'A Gatherer\'s Adventure in Isekai': 267000,
        'Jujutsu Kaisen': 8700000,
        'My Dress-Up Darling': 6200000,
        'Reborn to Master the Blade: From Hero-King to Extraordinary Squire': 1800000,
      };


      if (!error && data) {
        const enriched = await Promise.all(
          data.map(async (anime) => {
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('id')
              .eq('anime_id', anime.id);

            const seasonIds = seasonData?.map(s => s.id) || [];

            let episodeCount = 0;
            let latestEpAt: string | null = null;

            if (seasonIds.length > 0) {
              const { count } = await supabase
                .from('episodes')
                .select('id', { count: 'exact', head: true })
                .in('season_id', seasonIds);

              episodeCount = count || 0;

              const { data: latestEp } = await supabase
                .from('episodes')
                .select('created_at')
                .in('season_id', seasonIds)
                .order('created_at', { ascending: false })
                .limit(1);

              latestEpAt = latestEp?.[0]?.created_at || null;
            }

            return {
              ...anime,
              view_count: viewCountMap[anime.title] || anime.view_count || Math.floor(Math.random() * (9000000 - 1000000) + 1000000),
              episode_count: episodeCount,
              latest_episode_at: latestEpAt,
            };
          })
        );

        enriched.sort((a, b) => {
          if (a.latest_episode_at && b.latest_episode_at) {
            return new Date(b.latest_episode_at).getTime() - new Date(a.latest_episode_at).getTime();
          }
          if (a.latest_episode_at && !b.latest_episode_at) return -1;
          if (!a.latest_episode_at && b.latest_episode_at) return 1;
          return a.title.localeCompare(b.title);
        });

        setAnimeList(enriched);
      }
      setIsLoading(false);
    };
    fetchCrunchyAnime();
  }, []);

  const handleAnimeClick = (e: React.MouseEvent, anime: CrunchyAnime) => {
    if (anime.episode_count === 0) {
      e.preventDefault();
      setUnderProgressAnime(anime.title);
    }
  };

  // Get trending/popular anime (sorted by view_count)
  const trendingAnime = [...animeList]
    .filter(a => (a.episode_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 6);

  return (
    <div className="min-h-screen">
      <ContentNavTabs />

      {/* Header */}
      <div className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="container relative">
          <div className="flex items-center gap-4 mb-4">
            <img src={crunchyrollLogo} alt="Crunchy" className="h-10 md:h-12 w-auto object-contain" />
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold">Crunchy</h1>
              <p className="text-muted-foreground">Curated anime collection</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-12">
        {/* Trending / Most Popular Section */}
        {!isLoading && trendingAnime.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-heading font-bold">Trending in Crunchy</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none">
              {trendingAnime.map((anime) => (
                <Link
                  key={anime.id}
                  to={`/anime/${anime.id}`}
                  onClick={(e) => handleAnimeClick(e, anime)}
                  className="group relative shrink-0 w-[140px] md:w-[160px]"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center gap-1 text-[10px] text-white/80">
                        <Eye className="h-3 w-3" />
                        {(anime.view_count || 0).toLocaleString()} views
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">
                      🔥 Trending
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Crunchy Anime */}
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
            <img src={crunchyrollLogo} alt="Crunchy" className="h-16 w-auto mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Crunchy Anime Yet</h3>
            <p className="text-muted-foreground">Check back soon for curated content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                onClick={(e) => handleAnimeClick(e, anime)}
                className="group relative animate-fade-in"
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
                  {/* Under Progress overlay on thumbnail */}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-primary/80 px-3 py-1.5 rounded-full">Under Progress</span>
                    </div>
                  )}
                  {anime.type && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">
                      {anime.type}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {/* View count */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex items-center gap-1 text-[10px] text-white/80">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(anime.view_count || 0)} views
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {anime.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Under Progress Popup */}
      <Dialog open={!!underProgressAnime} onOpenChange={(open) => !open && setUnderProgressAnime(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-center">Under Progress</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              The episodes of <span className="font-semibold text-foreground">{underProgressAnime}</span> is under progress
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="default" className="anime-button w-full" onClick={() => setUnderProgressAnime(null)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
