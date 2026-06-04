import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, X, Sparkles, Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface UpcomingSeasonInfo {
  season_number: number;
  release_date: string | null; // ISO date 'YYYY-MM-DD'
  title?: string | null;
}

interface UpcomingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  banner_image?: string | null;
  release_year: number | null;
  created_at: string;
  type: string | null;
  status?: string | null;
  description?: string | null;
  genres?: string[] | null;
  studio?: string | null;
  total_episodes?: number | null;
  source_material?: string | null;
  content_rating?: string | null;
  upcoming_seasons?: number[];
  season_details?: UpcomingSeasonInfo[];
}

interface UpcomingCountdownDialogProps {
  anime: UpcomingAnime | null;
  onClose: () => void;
}

/** Pick the soonest explicit release date, otherwise keep it as unknown. */
function getTargetDate(anime: UpcomingAnime): { date: Date | null; source: 'season' | 'unknown'; season?: UpcomingSeasonInfo } {
  const withDate = (anime.season_details || []).filter(s => s.release_date);
  if (withDate.length) {
    const sorted = [...withDate].sort((a, b) => new Date(a.release_date!).getTime() - new Date(b.release_date!).getTime());
    return { date: new Date(`${sorted[0].release_date}T00:00:00`), source: 'season', season: sorted[0] };
  }
  return { date: null, source: 'unknown' };
}

function getTimeRemaining(targetDate: Date) {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, expired: false };
}

const NOTIFY_KEY = 'upcoming_notify_subs';
function getNotifySubs(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}'); } catch { return {}; }
}
function setNotifySubs(subs: Record<string, number>) {
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(subs));
}

export function UpcomingCountdownDialog({ anime, onClose }: UpcomingCountdownDialogProps) {
  const target = useMemo(() => (anime ? getTargetDate(anime) : null), [anime]);
  const [timeRemaining, setTimeRemaining] = useState(() =>
    target ? getTimeRemaining(target.date) : { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false }
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!anime) return;
    const subs = getNotifySubs();
    setIsSubscribed(!!subs[anime.id]);
  }, [anime]);

  useEffect(() => {
    if (!target) return;
    if (!target.date) {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
      return;
    }
    setTimeRemaining(getTimeRemaining(target.date));
    const interval = setInterval(() => {
      if (target.date) setTimeRemaining(getTimeRemaining(target.date));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!anime || !target) return null;

  const t = timeRemaining;
  const seasons = anime.upcoming_seasons && anime.upcoming_seasons.length > 0
    ? anime.upcoming_seasons
    : null;
  const seasonChip = seasons ? seasons.map(n => `S${n}`).join(' · ') : null;

  const releaseDateLabel = target.source === 'season'
    ? target.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Release date announce soon';

  const headlineSeason = target.source === 'season' && target.season ? target.season.season_number : (seasons?.[0] ?? null);

  const handleNotify = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported on this device');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      toast.error('Enable notifications in browser settings to subscribe');
      return;
    }
    const subs = getNotifySubs();
    if (subs[anime.id]) {
      delete subs[anime.id];
      setNotifySubs(subs);
      setIsSubscribed(false);
      toast.success('Notification reminder removed');
    } else {
      subs[anime.id] = target.date ? target.date.getTime() : Date.now();
      setNotifySubs(subs);
      setIsSubscribed(true);
      toast.success(`We'll notify you when "${anime.title}" releases!`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-scale-in"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        {/* Compact hero */}
        {(anime.banner_image || anime.cover_image) && (
          <div className="relative w-full h-28 shrink-0 overflow-hidden">
            <img
              src={anime.banner_image || anime.cover_image!}
              alt={anime.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {seasonChip && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/95 text-white text-[10px] font-bold shadow flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  {seasonChip}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-card/80 backdrop-blur text-foreground text-[9px] font-bold uppercase tracking-wider">
                Upcoming
              </span>
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-orange-500/30 scrollbar-track-transparent">
          <div className="flex items-start gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <h3 className="text-base font-bold text-foreground leading-tight">{anime.title}</h3>
          </div>

          {/* Headline */}
          <div className="mb-2.5 rounded-lg border border-orange-500/20 bg-orange-500/10 p-2.5">
            <p className="text-orange-400 text-xs font-bold leading-tight">
              {headlineSeason ? `Season ${headlineSeason} releasing` : 'Releasing'}
              {target.source === 'season' ? ' on' : ''}
            </p>
            <p className="text-foreground text-sm font-bold mt-0.5">{releaseDateLabel}</p>
          </div>

          {/* Compact meta row */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
              <p className="text-xs font-bold text-foreground truncate">{anime.status || 'Upcoming'}</p>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Episodes</p>
              <p className="text-xs font-bold text-foreground truncate">{anime.total_episodes || 'TBA'}</p>
            </div>
            {anime.studio && (
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Studio</p>
                <p className="text-xs font-bold text-foreground truncate">{anime.studio}</p>
              </div>
            )}
            {anime.source_material && (
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Source</p>
                <p className="text-xs font-bold text-foreground truncate">{anime.source_material}</p>
              </div>
            )}
          </div>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {anime.genres.slice(0, 5).map((g) => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {anime.description && (
            <p className="text-muted-foreground text-xs mb-2.5 line-clamp-3 leading-relaxed">
              {anime.description}
            </p>
          )}

          {/* Countdown */}
          {target.date && t.expired ? (
            <div className="text-center py-2 bg-primary/10 rounded-lg">
              <p className="text-primary text-sm font-bold">It's release day! 🎉</p>
            </div>
          ) : target.date ? (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 text-center">
                Live countdown
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Days', value: t.days },
                  { label: 'Hours', value: t.hours },
                  { label: 'Min', value: t.minutes },
                  { label: 'Sec', value: t.seconds },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="bg-muted rounded-md py-2">
                      <span className="text-lg font-mono font-bold text-foreground tabular-nums">
                        {String(item.value).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium mt-0.5 block uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 bg-muted rounded-lg">
              <p className="text-foreground text-xs font-semibold">Release date announce soon</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex gap-2 p-3 border-t border-border bg-card/95 backdrop-blur">
          <Button
            onClick={handleNotify}
            variant={isSubscribed ? 'default' : 'outline'}
            size="sm"
            className="flex-1 gap-1.5 h-9"
          >
            {isSubscribed ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
            <span className="text-xs font-semibold">{isSubscribed ? 'Notifying' : 'Notify me'}</span>
          </Button>
          <Button
            onClick={onClose}
            size="sm"
            className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
