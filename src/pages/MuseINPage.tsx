import { useState, useEffect, useCallback } from 'react';
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
import { TrendingUp, Eye, Sparkles, Clock, Film, Globe, Play, Flame, Star, Languages } from 'lucide-react';
import museinLogo from '@/assets/musein-logo.jpg';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';

// Launch date: 7 days from first deployment (set a fixed date)
const LAUNCH_DATE_KEY = 'musein_launch_date';

function getLaunchDate(): Date {
  const stored = localStorage.getItem(LAUNCH_DATE_KEY);
  if (stored) return new Date(stored);
  const launchDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  localStorage.setItem(LAUNCH_DATE_KEY, launchDate.toISOString());
  return launchDate;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(targetDate: Date): { timeLeft: TimeLeft; isExpired: boolean } {
  const calcTimeLeft = useCallback((): { timeLeft: TimeLeft; isExpired: boolean } => {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { timeLeft: { days: 0, hours: 0, minutes: 0, seconds: 0 }, isExpired: true };
    return {
      timeLeft: {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      },
      isExpired: false,
    };
  }, [targetDate]);

  const [state, setState] = useState(calcTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setState(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [calcTimeLeft]);

  return state;
}

// ─── Countdown (Coming Soon) View ───
function ComingSoonView({ timeLeft }: { timeLeft: TimeLeft }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const [museCount, setMuseCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('anime')
        .select('id', { count: 'exact', head: true })
        .eq('is_muse', true);
      setMuseCount(count || 0);
    };
    fetchCount();
  }, []);

  // Calculate progress percentage (7 days total)
  const totalMs = 7 * 24 * 60 * 60 * 1000;
  const remainingMs = (timeLeft.days * 86400 + timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds) * 1000;
  const progressPct = Math.max(0, Math.min(100, ((totalMs - remainingMs) / totalMs) * 100));

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      {/* Cinematic background */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-pink-500/8 to-transparent" />
      <div className="absolute -top-32 left-1/4 w-[32rem] h-[32rem] bg-rose-500/20 rounded-full blur-[140px]" />
      <div className="absolute top-20 right-1/4 w-[24rem] h-[24rem] bg-pink-400/15 rounded-full blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />

      <div className="container relative py-14 md:py-20 flex flex-col items-center text-center px-4">
        {/* Logo */}
        <div className="relative mb-7">
          <div className="absolute inset-0 bg-rose-500/30 rounded-full blur-2xl scale-150 animate-pulse" />
          <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full p-1 bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600">
            <img src={museinLogo} alt="MuseIN" className="w-full h-full rounded-full object-cover border-2 border-background" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-rose-500 border-4 border-background flex items-center justify-center shadow-lg">
            <Sparkles className="h-4 w-4 text-white animate-pulse" />
          </div>
        </div>

        {/* Live badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 mb-4">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-[0.15em]">Launching Soon</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight leading-none mb-3">
          Muse<span className="bg-gradient-to-r from-rose-400 via-pink-500 to-rose-500 bg-clip-text text-transparent">IN</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground mb-2 max-w-md">
          Premium Hindi Dubbed Anime by Muse India — coming to your screens.
        </p>

        {/* Countdown Timer */}
        <div className="flex items-center gap-2 md:gap-4 my-8">
          {[
            { value: timeLeft.days, label: 'Days' },
            { value: timeLeft.hours, label: 'Hours' },
            { value: timeLeft.minutes, label: 'Minutes' },
            { value: timeLeft.seconds, label: 'Seconds' },
          ].map((unit, i) => (
            <div key={unit.label} className="flex items-center gap-2 md:gap-4">
              <div className="flex flex-col items-center">
                <div className="relative w-[68px] h-[68px] md:w-[88px] md:h-[88px] rounded-2xl bg-gradient-to-br from-card to-card/40 border border-rose-500/20 backdrop-blur-sm flex items-center justify-center overflow-hidden shadow-xl">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-rose-500/10 to-transparent" />
                  <span className="relative text-3xl md:text-4xl font-heading font-black text-foreground tabular-nums">
                    {pad(unit.value)}
                  </span>
                </div>
                <span className="text-[9px] md:text-[10px] text-muted-foreground mt-2 uppercase tracking-[0.2em] font-bold">{unit.label}</span>
              </div>
              {i < 3 && <span className="text-2xl md:text-3xl font-black text-rose-500/40 -mt-5">:</span>}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-sm mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Launch Progress</span>
            <span className="text-[10px] font-black text-rose-400">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-rose-500 transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-sm">
            <Film className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-xs font-semibold">{museCount} Anime Queued</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-sm">
            <Languages className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-xs font-semibold">Hindi Dubbed</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">4K Premium</span>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-3xl w-full mb-10">
          {[
            { icon: Film, title: 'Official Hindi Dub', desc: 'Licensed from Muse India' },
            { icon: Globe, title: 'HD & 4K Quality', desc: 'Crystal clear streaming' },
            { icon: Clock, title: 'Regular Updates', desc: 'New episodes weekly' },
            { icon: Sparkles, title: 'Curated Library', desc: 'Hand-picked anime' },
          ].map((f) => (
            <div key={f.title} className="group relative overflow-hidden flex flex-col items-center gap-2 p-4 rounded-2xl bg-card/50 border border-border/40 backdrop-blur-sm hover:border-rose-500/40 hover:-translate-y-0.5 transition-all">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/15 to-pink-500/10 border border-rose-500/20">
                <f.icon className="h-4 w-4 text-rose-400" />
              </div>
              <h3 className="text-xs font-bold">{f.title}</h3>
              <p className="text-[10px] text-muted-foreground leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Anime marked with <span className="inline-block px-1.5 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded uppercase tracking-wider">H-DUB</span> will appear here automatically.
        </p>
      </div>
    </div>
  );
}

// ─── Live Listing View ───
interface MuseAnime {
  id: string;
  title: string;
  cover_image: string | null;
  type: string | null;
  status: string | null;
  view_count: number | null;
  episode_count?: number;
  latest_episode_at?: string | null;
}

function formatViewCount(count: number) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return count.toString();
}

function LiveListingView() {
  const [animeList, setAnimeList] = useState<MuseAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [underProgressAnime, setUnderProgressAnime] = useState<string | null>(null);

  useEffect(() => {
    const fetchMuseAnime = async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('id, title, cover_image, type, status, view_count')
        .eq('is_muse', true as any)
        .order('title');

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
              view_count: anime.view_count || Math.floor(Math.random() * (5000000 - 500000) + 500000),
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
    fetchMuseAnime();
  }, []);

  const handleAnimeClick = (e: React.MouseEvent, anime: MuseAnime) => {
    if (anime.episode_count === 0) {
      e.preventDefault();
      setUnderProgressAnime(anime.title);
    }
  };

  const trendingAnime = [...animeList]
    .filter(a => (a.episode_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 6);

  const totalEpisodes = animeList.reduce((sum, a) => sum + (a.episode_count || 0), 0);
  const readyCount = animeList.filter(a => (a.episode_count || 0) > 0).length;

  return (
    <>
      {/* Cinematic Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-pink-500/8 to-transparent" />
        <div className="absolute -top-20 right-1/4 w-[24rem] h-[24rem] bg-rose-500/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(var(--background)),transparent_70%)]" />

        <div className="container relative px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-7">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-rose-500/30 blur-2xl rounded-full" />
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl p-0.5 bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600">
                <img src={museinLogo} alt="MuseIN" className="w-full h-full rounded-2xl object-cover" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 mb-3">
                <Languages className="h-3 w-3 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Hindi Dub Library</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-heading font-black tracking-tight leading-none">
                Muse<span className="bg-gradient-to-r from-rose-400 via-pink-500 to-rose-500 bg-clip-text text-transparent">IN</span>
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm md:text-base">
                Hindi dubbed anime by Muse India — official, premium, and ready to stream.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Play className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-xs font-semibold">{readyCount} Series</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">{totalEpisodes} Episodes</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-sm">
                  <Globe className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-xs font-semibold">4K Quality</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 pb-12">
        {/* Trending Section */}
        {!isLoading && trendingAnime.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-rose-500/40 blur-md rounded-lg" />
                  <div className="relative p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-heading font-black">Trending in MuseIN</h2>
                  <p className="text-[11px] text-muted-foreground">Top Hindi dubs this week</p>
                </div>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none">
              {trendingAnime.map((anime, idx) => (
                <Link key={anime.id} to={`/anime/${anime.id}`} onClick={(e) => handleAnimeClick(e, anime)} className="group relative shrink-0 w-[150px] md:w-[170px]">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/30 group-hover:ring-rose-500/50 transition-all duration-300">
                    <div className="absolute -left-1 top-2 z-20">
                      <div
                        className="text-5xl md:text-6xl font-heading font-black leading-none"
                        style={{
                          WebkitTextStroke: '2px rgba(244, 63, 94, 0.9)',
                          color: 'transparent',
                          textShadow: '0 4px 20px rgba(244, 63, 94, 0.3)',
                        }}
                      >
                        {idx + 1}
                      </div>
                    </div>
                    {anime.cover_image ? (
                      <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-rose-500/95 flex items-center justify-center shadow-2xl shadow-rose-500/50 scale-90 group-hover:scale-100 transition-transform">
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
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-md uppercase tracking-wider">H-DUB</div>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold line-clamp-2 group-hover:text-rose-400 transition-colors">{anime.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All MUSE Anime */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-6 w-1 rounded-full bg-gradient-to-b from-rose-400 to-pink-500" />
          <h2 className="text-lg md:text-xl font-heading font-black">Full MuseIN Library</h2>
          <span className="text-xs text-muted-foreground">({animeList.length})</span>
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
        ) : animeList.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border/50 bg-card/30">
            <img src={museinLogo} alt="MuseIN" className="h-16 w-16 rounded-full mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No MuseIN Anime Yet</h3>
            <p className="text-muted-foreground text-sm">Check back soon for Hindi dubbed content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => (
              <Link key={anime.id} to={`/anime/${anime.id}`} onClick={(e) => handleAnimeClick(e, anime)} className="group relative animate-fade-in" style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}>
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted ring-1 ring-border/30 group-hover:ring-rose-500/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-rose-500/20">
                  {anime.cover_image ? (
                    <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white text-[10px] font-black bg-rose-500/90 px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">Under Progress</span>
                    </div>
                  )}
                  {anime.type && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[9px] font-bold text-white uppercase tracking-wider border border-white/10">{anime.type}</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  {(anime.episode_count || 0) > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-11 h-11 rounded-full bg-rose-500/95 flex items-center justify-center shadow-2xl shadow-rose-500/50 scale-90 group-hover:scale-100 transition-transform">
                        <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-white/90 font-medium">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(anime.view_count || 0)}
                    </div>
                    {(anime.episode_count || 0) > 0 && (
                      <span className="text-[9px] font-bold text-white/80 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur-sm">{anime.episode_count} EP</span>
                    )}
                  </div>
                  <TokenCrownBadge />
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md shadow-md uppercase tracking-wider">H-DUB</div>
                </div>
                <div className="mt-2.5">
                  <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-rose-400 transition-colors">{anime.title}</h3>
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
              <span className="font-semibold text-foreground">{underProgressAnime}</span> is still being prepared for the MuseIN tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            {[
              { icon: '🎌', title: 'Hindi dub pack in progress', desc: 'Episode files, dubbed audio and season mapping are still being lined up.' },
              { icon: '📝', title: 'Subtitle + CC review', desc: 'E-sub timing and subtitle visibility are tested before publishing.' },
              { icon: '🚀', title: 'Launch quality check', desc: 'Playback quality, posters and watch-page polish are being finalized.' },
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
              This title will appear here as soon as the first MuseIN-ready episode pack passes QA.
            </p>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="default" className="anime-button w-full" onClick={() => setUnderProgressAnime(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ───
const BYPASS_EMAIL = 'savi2570p@gmail.com';

export default function MuseINPage() {
  // Countdown disabled — MuseIN now opens directly into the live listing.
  return (
    <div className="min-h-screen">
      <ContentNavTabs />
      <LiveListingView />
    </div>
  );
}
