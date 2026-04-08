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
import { TrendingUp, Eye, Sparkles, Clock, Film, Globe } from 'lucide-react';
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
    <div className="container py-16 md:py-24 flex flex-col items-center text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150" />
        <img src={museinLogo} alt="MuseIN" className="relative h-24 w-24 md:h-32 md:w-32 rounded-full object-cover border-4 border-primary/30 shadow-xl" />
      </div>

      <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">
        Muse<span className="anime-gradient-text">IN</span>
      </h1>
      <p className="text-lg text-muted-foreground mb-2">Hindi Dubbed Anime by Muse India</p>

      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-sm font-semibold text-primary">Launching Soon</span>
      </div>

      {/* Countdown Timer */}
      <div className="flex items-center gap-3 md:gap-5 mb-6">
        {[
          { value: timeLeft.days, label: 'Days' },
          { value: timeLeft.hours, label: 'Hours' },
          { value: timeLeft.minutes, label: 'Minutes' },
          { value: timeLeft.seconds, label: 'Seconds' },
        ].map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-3 md:gap-5">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-heading font-bold text-primary tabular-nums">
                  {pad(unit.value)}
                </span>
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{unit.label}</span>
            </div>
            {i < 3 && <span className="text-xl md:text-2xl font-bold text-muted-foreground/50 -mt-5">:</span>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-3">
        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">{Math.round(progressPct)}% ready</p>
      </div>

      {/* Stats badges */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/40">
          <Film className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">{museCount} Anime Queued</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/40">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Hindi Dubbed</span>
        </div>
      </div>

      <p className="max-w-lg text-muted-foreground mb-10">
        We're building a dedicated space for all <span className="font-semibold text-foreground">Muse India</span> Hindi dubbed anime.
        Stay tuned — your favorite shows will be available here very soon!
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl w-full mb-12">
        {[
          { icon: Film, title: 'Official Hindi Dub', desc: 'Licensed content from Muse India' },
          { icon: Globe, title: 'HD & 4K Quality', desc: 'Crystal clear streaming' },
          { icon: Clock, title: 'Regular Updates', desc: 'New episodes added frequently' },
          { icon: Sparkles, title: 'Exclusive Collection', desc: 'Curated anime library' },
        ].map((f) => (
          <div key={f.title} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/40 border border-border/50">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="text-sm font-semibold">{f.title}</h3>
            <p className="text-[11px] text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Anime marked with <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded">H-DUB</span> will appear here automatically.
      </p>
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

  return (
    <>
      {/* Header - sticky */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/30 px-4 py-3">
        <div className="container">
          <div className="flex items-center gap-3">
            <img src={museinLogo} alt="MuseIN" className="h-9 md:h-10 w-9 md:w-10 rounded-full object-cover" />
            <div>
              <h1 className="text-xl md:text-2xl font-heading font-bold leading-tight">MuseIN</h1>
              <p className="text-xs text-muted-foreground">Hindi dubbed anime by Muse India</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container pb-12">
        {/* Trending Section */}
        {!isLoading && trendingAnime.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-heading font-bold">Trending in MuseIN</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none">
              {trendingAnime.map((anime) => (
                <Link key={anime.id} to={`/anime/${anime.id}`} onClick={(e) => handleAnimeClick(e, anime)} className="group relative shrink-0 w-[140px] md:w-[160px]">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                    {anime.cover_image ? (
                      <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                        <span className="text-muted-foreground">No Image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center gap-1 text-[10px] text-white/80">
                        <Eye className="h-3 w-3" />
                        {formatViewCount(anime.view_count || 0)} views
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary/90 text-[10px] font-bold text-primary-foreground">🔥 Trending</div>
                    <TokenCrownBadge />
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-lg shadow-md">H-DUB</div>
                  </div>
                  <h3 className="mt-2 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{anime.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All MUSE Anime */}
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
            <img src={museinLogo} alt="MuseIN" className="h-16 w-16 rounded-full mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No MuseIN Anime Yet</h3>
            <p className="text-muted-foreground">Check back soon for Hindi dubbed content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {animeList.map((anime, index) => (
              <Link key={anime.id} to={`/anime/${anime.id}`} onClick={(e) => handleAnimeClick(e, anime)} className="group relative animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  {anime.cover_image ? (
                    <img src={anime.cover_image} alt={anime.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                  {anime.episode_count === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-primary/80 px-3 py-1.5 rounded-full">Under Progress</span>
                    </div>
                  )}
                  {anime.type && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-muted/90 text-[10px] font-bold uppercase">{anime.type}</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="flex items-center gap-1 text-[10px] text-white/80">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(anime.view_count || 0)} views
                    </div>
                  </div>
                  <TokenCrownBadge />
                  <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-lg shadow-md">H-DUB</div>
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{anime.title}</h3>
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
  const [launchDate] = useState(getLaunchDate);
  const { timeLeft, isExpired } = useCountdown(launchDate);
  const [canBypass, setCanBypass] = useState(false);

  useEffect(() => {
    const checkBypass = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email?.toLowerCase() === BYPASS_EMAIL) {
        setCanBypass(true);
      }
    };
    checkBypass();
  }, []);

  const showListing = isExpired || canBypass;

  return (
    <div className="min-h-screen">
      <ContentNavTabs />
      {showListing ? <LiveListingView /> : <ComingSoonView timeLeft={timeLeft} />}
    </div>
  );
}
