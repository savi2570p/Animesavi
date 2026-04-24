import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Play, X, History, ChevronRight } from 'lucide-react';

const NOTIFICATION_KEY = 'continue_watching_notification_shown';

interface WatchHistoryItem {
  id: string;
  anime: {
    id: string;
    title: string;
    cover_image: string | null;
    banner_image: string | null;
  };
  episode: {
    id: string;
    title: string;
    episode_number: number;
    thumbnail: string | null;
    season_id: string;
    duration: number | null;
  };
  progress: number | null;
  watched_at: string;
  season?: {
    season_number: number;
  };
}

function formatTimeLeft(progress: number, durationSec: number | null) {
  if (!durationSec || durationSec <= 0) return null;
  const remaining = Math.max(0, durationSec - (progress / 100) * durationSec);
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m left`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s left`;
}

export function ContinueWatchingNotification() {
  const { user } = useAuth();
  const [lastWatched, setLastWatched] = useState<WatchHistoryItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const sessionShown = sessionStorage.getItem(NOTIFICATION_KEY);
    if (sessionShown === 'true') return;
    fetchLastWatched();
  }, [user]);

  const fetchLastWatched = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('watch_history')
      .select('*, anime:anime_id(*), episode:episode_id(*)')
      .eq('user_id', user.id)
      .eq('completed', false)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single();

    if (data && data.anime && data.episode && data.progress && data.progress > 5 && data.progress < 95) {
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('id', (data.episode as any).season_id)
        .single();

      setLastWatched({
        ...data,
        season: seasonData || undefined,
      } as WatchHistoryItem);

      setTimeout(() => setIsVisible(true), 1500);
    }
  };

  const close = () => {
    setIsClosing(true);
    sessionStorage.setItem(NOTIFICATION_KEY, 'true');
    setTimeout(() => setIsVisible(false), 250);
  };

  const handleResume = () => {
    sessionStorage.setItem(NOTIFICATION_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible || !lastWatched) return null;

  const progress = Math.round(lastWatched.progress || 0);
  const timeLeft = formatTimeLeft(progress, lastWatched.episode.duration);
  const backdrop =
    lastWatched.episode.thumbnail ||
    lastWatched.anime.banner_image ||
    lastWatched.anime.cover_image ||
    '/placeholder.svg';

  return (
    <div
      className={`fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 w-[300px] sm:w-[360px] ${
        isClosing ? 'animate-out fade-out slide-out-to-bottom-4' : 'animate-in fade-in slide-in-from-bottom-4'
      } duration-300`}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-primary/20">
        {/* Backdrop image */}
        <div className="relative h-32 sm:h-36 w-full overflow-hidden">
          <img
            src={backdrop}
            alt={lastWatched.anime.title}
            className="absolute inset-0 h-full w-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />

          {/* Top label */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur-md shadow-lg">
            <History className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              Pick up where you left
            </span>
          </div>

          {/* Close */}
          <button
            onClick={close}
            aria-label="Dismiss"
            className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md flex items-center justify-center transition-all hover:scale-110"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>

          {/* Title overlay */}
          <div className="absolute bottom-2.5 left-3 right-3">
            <h4 className="text-white font-bold text-sm sm:text-base line-clamp-1 drop-shadow-lg">
              {lastWatched.anime.title}
            </h4>
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5 line-clamp-1">
              S{lastWatched.season?.season_number || 1} · E{lastWatched.episode.episode_number}
              {lastWatched.episode.title ? ` — ${lastWatched.episode.title}` : ''}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 space-y-3">
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] sm:text-xs">
              <span className="text-white/60 font-medium">{progress}% watched</span>
              {timeLeft && <span className="text-white/40">{timeLeft}</span>}
            </div>
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={close}
              className="h-9 px-3 text-xs text-white/70 hover:text-white hover:bg-white/10"
            >
              Later
            </Button>
            <Button
              size="sm"
              asChild
              onClick={handleResume}
              className="flex-1 h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm rounded-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all group/btn"
            >
              <Link to={`/watch/${lastWatched.episode.id}?t=${lastWatched.progress || 0}`}>
                <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                Resume
                <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-0 -translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Subtle red glow accent */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-inset ring-white/5" />
      </div>
    </div>
  );
}
