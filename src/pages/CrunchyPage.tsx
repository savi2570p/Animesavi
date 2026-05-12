import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, Eye, Flame, Sparkles, Play, Star, Crown } from 'lucide-react';
import crunchyrollLogo from '@/assets/crunchyroll-logo.png';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { PageLoader } from '@/components/layout/PageLoader';

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
  const [filter, setFilter] = useState<'all' | 'new' | 'trending'>('all');

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
              view_count: viewCountMap[anime.title] || Math.floor(Math.random() * (9000000 - 1000000) + 1000000),
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

  const trendingAnime = [...animeList]
    .filter(a => (a.episode_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 8);

  const isNew = (date: string | null | undefined) => {
    if (!date) return false;
    return Date.now() - new Date(date).getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  const filteredList = animeList.filter((a) => {
    if (filter === 'new') return isNew(a.latest_episode_at);
    if (filter === 'trending') return (a.view_count || 0) > 2000000;
    return true;
  });

  const totalEpisodes = animeList.reduce((sum, a) => sum + (a.episode_count || 0), 0);
  const readyCount = animeList.filter(a => (a.episode_count || 0) > 0).length;

  return (
    <div className="min-h-screen">
      {isLoading && <PageLoader label="Loading Crunchy" accent="orange-500" logo={crunchyrollLogo} done={!isLoading} />}
      <ContentNavTabs />

      {/* Cinematic Header */}
      <div className="relative overflow-hidden">
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent" />
        <div className="absolute -top-20 right-1/4 w-[28rem] h-[28rem] bg-orange-500/20 rounded-full blur-[120px]" />
        <div className="absolute -top-10 left-1/3 w-[20rem] h-[20rem] bg-amber-400/15 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />

        <div className="container relative px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-8">
            {/* Logo block */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full" />
              <div className="relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 backdrop-blur-sm">
                <img src={crunchyrollLogo} alt="Crunchy" className="h-12 md:h-14 w-auto object-contain" />
              </div>
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 mb-3">
                <Sparkles className="h-3 w-3 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider">Curated Collection</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tight leading-none">
                Crunchy
                <span className="text-orange-400">.</span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
                A hand-picked library of premium licensed anime — streamed in stunning quality with H-DUB support.
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Play className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-xs font-semibold">{readyCount} Series</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">{totalEpisodes} Episodes</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold">Premium 4K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mt-8 overflow-x-auto scrollbar-none -mx-4 px-4">
            {([
              { key: 'all', label: 'All Titles', icon: null },
              { key: 'trending', label: 'Trending', icon: Flame },
              { key: 'new', label: 'New This Week', icon: Sparkles },
            ] as const).map((f) => {
              const Icon = f.icon;
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-[1.02]'
                      : 'bg-card/60 text-muted-foreground border border-border/40 hover:bg-card hover:text-foreground'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container px-4 pb-12">
        {/* Trending Spotlight */}
        {!isLoading && trendingAnime.length > 0 && filter === 'all' && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-orange-500/40 blur-md rounded-lg" />
                  <div className="relative p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-heading font-black">Trending Now</h2>
                  <p className="text-[11px] text-muted-foreground">Most watched on Crunchy this week</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                </span>
                <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider">Live</span>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none">
              {trendingAnime.map((anime, idx) => (
                <Link
                  key={anime.id}
                  to={`/anime/${anime.id}`}
                  onClick={(e) => handleAnimeClick(e, anime)}
                  className="group relative shrink-0 w-[150px] md:w-[170px]"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/30 group-hover:ring-orange-500/50 transition-all duration-300">
                    {/* Rank number */}
                    <div className="absolute -left-1 top-2 z-20">
                      <div
                        className="text-5xl md:text-6xl font-heading font-black leading-none"
                        style={{
                          WebkitTextStroke: '2px rgba(251, 146, 60, 0.9)',
                          color: 'transparent',
                          textShadow: '0 4px 20px rgba(251, 146, 60, 0.3)',
                        }}
                      >
                        {idx + 1}
                      </div>
                    </div>

                    {anime.cover_image ? (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}

                    {/* Letterbox bars on hover */}
                    <div className="absolute inset-x-0 top-0 h-3 bg-black translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300" />
                    <div className="absolute inset-x-0 bottom-0 h-3 bg-black translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-orange-500/95 flex items-center justify-center shadow-2xl shadow-orange-500/50 scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium">
                        <Eye className="h-3 w-3" />
                        {formatViewCount(anime.view_count || 0)}
                      </div>
                    </div>

                    <TokenCrownBadge />
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-md uppercase tracking-wider">
                      H-DUB
                    </div>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold line-clamp-2 group-hover:text-orange-400 transition-colors">
                    {anime.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Crunchy Anime */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-500" />
          <h2 className="text-lg md:text-xl font-heading font-black">
            {filter === 'all' ? 'Full Library' : filter === 'new' ? 'Fresh Releases' : 'Most Watched'}
          </h2>
          <span className="text-xs text-muted-foreground">({filteredList.length})</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border/50 bg-card/30">
            <img src={crunchyrollLogo} alt="Crunchy" className="h-16 w-auto mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Nothing here yet</h3>
            <p className="text-muted-foreground text-sm">Try switching the filter or check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredList.map((anime, index) => (
              <Link
                key={anime.id}
                to={`/anime/${anime.id}`}
                onClick={(e) => handleAnimeClick(e, anime)}
                className="group relative animate-fade-in"
                style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/30 group-hover:ring-orange-500/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-orange-500/20">
                  {anime.cover_image ? (
                    <img
                      src={anime.cover_image}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}

                  {/* Under Progress overlay */}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white text-[10px] font-black bg-orange-500/90 px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
                        Under Progress
                      </span>
                    </div>
                  )}

                  {/* NEW badge */}
                  {isNew(anime.latest_episode_at) && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-[9px] font-black text-white uppercase tracking-wider shadow-md">
                      New
                    </div>
                  )}

                  {/* Type badge */}
                  {anime.type && !isNew(anime.latest_episode_at) && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">
                      {anime.type}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

                  {/* Play overlay on hover */}
                  {(anime.episode_count || 0) > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-11 h-11 rounded-full bg-orange-500/95 flex items-center justify-center shadow-2xl shadow-orange-500/50 scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Bottom info */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(anime.view_count || 0)}
                    </div>
                    {(anime.episode_count || 0) > 0 && (
                      <span className="text-[9px] font-bold text-white/80 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm">
                        {anime.episode_count} EP
                      </span>
                    )}
                  </div>

                  <TokenCrownBadge />
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-md uppercase tracking-wider">
                    H-DUB
                  </div>
                </div>
                <div className="mt-2.5">
                  <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-orange-400 transition-colors">
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
            <DialogDescription className="text-center text-sm pt-2">
              <span className="font-semibold text-foreground">{underProgressAnime}</span> is still being prepared for the Crunchy tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {[
              { icon: '📦', title: 'Episode sync in progress', desc: 'Season entries are ready, but the first episode files are still being linked.' },
              { icon: '🎧', title: 'Audio + E-sub QA', desc: 'Multi-audio tracks, English subtitles and CC support are being checked.' },
              { icon: '✨', title: 'Final watch-page review', desc: 'Posters, playback quality and player controls are being verified before release.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/40 p-3">
                <span className="text-base leading-none">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground text-center">
              This title will open automatically once the first Crunchy episode pack is ready.
            </p>
          </div>
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
