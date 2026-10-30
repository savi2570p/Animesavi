import { ResumeArtwork } from '@/components/anime/ResumeArtwork';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const [lastWatched, setLastWatched] = useState<WatchHistoryItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Only render on the main/home page
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (!user || !isHome) return;
    const sessionShown = sessionStorage.getItem(NOTIFICATION_KEY);
    if (sessionShown === 'true') return;
    fetchLastWatched();
  }, [user, isHome]);

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

  if (!isHome || !isVisible || !lastWatched) return null;

  const progress = Math.round(lastWatched.progress || 0);
  const timeLeft = formatTimeLeft(progress, lastWatched.episode.duration);

  return (
    <aside aria-label="Continue Watching" className={`resume-notice-v8 fixed z-50 ${isClosing ? 'motion-safe:animate-out motion-safe:fade-out' : 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2'} duration-200`}>
      <div className="utility-glass-v6 overflow-hidden">
        <div className="resume-art-v8 resume-original-art relative aspect-video bg-background overflow-hidden">
          <ResumeArtwork sources={[lastWatched.episode.thumbnail, lastWatched.anime.banner_image, lastWatched.anime.cover_image]} alt={lastWatched.anime.title} width={480} loading="eager" />
          <span className="resume-label-v8 utility-fab-v6 absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold"><History className="h-3 w-3 text-primary" />Continue Watching</span>
          <Button variant="glass" size="icon" onClick={close} aria-label="Dismiss" title="Dismiss" className="absolute top-2 right-2 h-8 w-8 rounded-md"><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="p-2.5 space-y-2">
          <div className="min-w-0">
            <h4 className="text-xs font-semibold line-clamp-1">{lastWatched.anime.title}</h4>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">S{lastWatched.season?.season_number || 1} · E{lastWatched.episode.episode_number}{lastWatched.episode.title ? ` — ${lastWatched.episode.title}` : ''}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground"><span>{progress}% watched</span>{timeLeft && <span>{timeLeft}</span>}</div>
            <div className="utility-progress-v6"><span style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="glass" size="sm" onClick={close} className="text-xs rounded-md">Later</Button>
            <Button size="sm" asChild onClick={handleResume} className="flex-1 text-xs rounded-md">
              <Link to={`/watch/${lastWatched.episode.id}?t=${lastWatched.progress || 0}`}><Play className="h-3.5 w-3.5 fill-current" />Resume<ChevronRight className="h-3.5 w-3.5 ml-auto" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
