import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Play, Eye, Crown } from 'lucide-react';

interface PopularAnime {
  id: string;
  title: string;
  cover_image: string | null;
  view_count: number;
  genres: string[] | null;
}

// Curated view counts for specific anime
const VIEW_COUNT_MAP: Record<string, number> = {
  'Your Name': 9500000,
  'Your lie in April': 3400000,
  'The Angel Next Door Spoils me Rotten': 1200000,
  'The angel next door spoils me rotten': 1200000,
  'Mechanical Marie': 977000,
  'Solo Leveling': 730000,
  "BOFURI: I Don't Want to Get Hurt, so I'll Max Out My Defense.": 2300000,
  "A Gatherer's Adventure in Isekai": 267000,
};

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  return `${(views / 1000).toFixed(0)}K`;
};

export function MostPopularSection() {
  const [animeList, setAnimeList] = useState<PopularAnime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPopularAnime();
  }, []);

  const fetchPopularAnime = async () => {
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, view_count, genres')
        .order('view_count', { ascending: false })
        .limit(10);

      if (error) throw error;

      const animeWithViews = (data || []).map(anime => ({
        ...anime,
        view_count: VIEW_COUNT_MAP[anime.title] || 
          (anime.view_count && anime.view_count > 0 ? anime.view_count : Math.floor(Math.random() * (900000 - 100000) + 100000))
      }));

      // Sort by view count (highest first)
      animeWithViews.sort((a, b) => b.view_count - a.view_count);

      setAnimeList(animeWithViews);
    } catch (error) {
      console.error('Error fetching popular anime:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-10 p-6 bg-card/50 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold">Top 10 Most Popular</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (animeList.length === 0) return null;

  return (
    <div className="mb-10 p-6 bg-card/50 rounded-2xl border border-border/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-heading font-bold">Top 10 Most Popular</h2>
        <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
          All Time
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {animeList.map((anime, index) => (
          <Link
            key={anime.id}
            to={`/anime/${anime.id}`}
            className="group relative block animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-md group-hover:shadow-xl transition-all duration-300">
              <img
                src={anime.cover_image || '/placeholder.svg'}
                alt={anime.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />

              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="p-3 rounded-full bg-primary/90 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                  <Play className="h-5 w-5 text-primary-foreground fill-current" />
                </div>
              </div>

              {/* Rank Badge */}
              <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-sm shadow-md ${
                index === 0 ? 'bg-yellow-500 text-black' :
                index === 1 ? 'bg-gray-300 text-black' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-primary text-primary-foreground'
              }`}>
                {index < 3 && <Crown className="h-3 w-3" />}
                #{index + 1}
              </div>

              {/* View Count */}
              <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-black/60 text-white rounded-lg flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViews(anime.view_count)}
              </div>

              {/* Title at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-sm font-semibold text-white line-clamp-2 drop-shadow-lg">
                  {anime.title}
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
