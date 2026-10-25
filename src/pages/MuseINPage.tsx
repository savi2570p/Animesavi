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
import { TrendingUp, Eye, Sparkles, Clock, Film, Globe, Play, Flame, Star, Languages, Layers } from 'lucide-react';
import museinLogo from '@/assets/musein-logo.jpg';
import { TokenCrownBadge } from '@/components/TokenCrownBadge';
import { ContentNavTabs } from '@/components/layout/ContentNavTabs';
import { PlatformCatalogueHeader, PlatformCatalogueCard } from '@/components/layout/PlatformCatalogue';
import { PlatformLoadingScreen } from '@/components/layout/PlatformLoadingScreen';

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
              // Real view counts on this tab are not yet seeded — anything below 1000
              // is treated as an unset value and replaced with a curated 1M–10M range.
              view_count:
                anime.view_count && anime.view_count >= 1000
                  ? anime.view_count
                  : Math.floor(Math.random() * (9_500_000 - 1_000_000) + 1_000_000),
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
      {isLoading && <PlatformLoadingScreen platform="musein" logo={museinLogo} />}
      <div className="platform-collection" data-platform="musein">
        <div className="container">
          <PlatformCatalogueHeader name="MuseIN" logo={museinLogo} series={readyCount} episodes={totalEpisodes} />
          {!isLoading && trendingAnime.length > 0 && <section className="platform-collection-section" aria-label="Trending in MuseIN">
            <div className="platform-collection-section-heading"><div className="flex items-center gap-2.5"><Flame className="platform-collection-tone h-5 w-5" /><h2>Trending in MuseIN</h2></div><span className="text-xs text-muted-foreground">Top {trendingAnime.length}</span></div>
            <div className="platform-collection-row snap-row">
              {trendingAnime.map((anime, index) => <PlatformCatalogueCard key={anime.id} anime={anime} rank={index + 1} views={formatViewCount(anime.view_count || 0)} onClick={(event) => handleAnimeClick(event, anime)} />)}
            </div>
          </section>}
          <section className="platform-collection-section" aria-label="MuseIN library">
            <div className="platform-collection-section-heading"><div className="flex items-center gap-2.5"><Layers className="platform-collection-tone h-5 w-5" /><h2>Full MuseIN Library</h2></div><span className="text-xs text-muted-foreground">{animeList.length} titles</span></div>
            {isLoading ? <div className="platform-collection-grid">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-[258px] rounded-lg" />)}</div> : animeList.length === 0 ? <div className="platform-collection-empty"><img src={museinLogo} alt="" className="h-12 w-12 object-contain mx-auto mb-4" /><h3 className="font-semibold">Nothing here yet</h3><p className="text-sm text-muted-foreground mt-2">Check back soon for more titles.</p></div> : <div className="platform-collection-grid">
              {animeList.map((anime) => <PlatformCatalogueCard key={anime.id} anime={anime} views={formatViewCount(anime.view_count || 0)} onClick={(event) => handleAnimeClick(event, anime)} />)}
            </div>}
          </section>
        </div>
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
