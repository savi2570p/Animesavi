import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, X, Tag, Film, Sparkles, Bell, BellRing } from 'lucide-react';
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
  release_year: number | null;
  created_at: string;
  type: string | null;
  description?: string | null;
  genres?: string[] | null;
  upcoming_seasons?: number[];
  // Optional richer per-season info (preferred when present)
  season_details?: UpcomingSeasonInfo[];
}

interface UpcomingCountdownDialogProps {
  anime: UpcomingAnime | null;
  onClose: () => void;
}

/** Pick the soonest release date from per-season info, else fall back to Jan 1 of release_year. */
function getTargetDate(anime: UpcomingAnime): { date: Date; source: 'season' | 'year'; season?: UpcomingSeasonInfo } {
  const withDate = (anime.season_details || []).filter(s => s.release_date);
  if (withDate.length) {
    const sorted = [...withDate].sort((a, b) => new Date(a.release_date!).getTime() - new Date(b.release_date!).getTime());
    return { date: new Date(`${sorted[0].release_date}T00:00:00`), source: 'season', season: sorted[0] };
  }
  const year = anime.release_year || new Date().getFullYear() + 1;
  return { date: new Date(year, 0, 1, 0, 0, 0), source: 'year' };
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
    setTimeRemaining(getTimeRemaining(target.date));
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(target.date));
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
    : `Sometime in ${anime.release_year || target.date.getFullYear()}`;

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
      subs[anime.id] = target.date.getTime();
      setNotifySubs(subs);
      setIsSubscribed(true);
      toast.success(`We'll notify you when "${anime.title}" releases!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl animate-scale-in relative my-auto overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        {/* Cinematic cover */}
        {anime.cover_image && (
          <div className="relative w-full h-48 overflow-hidden">
            <img
              src={anime.cover_image}
              alt={anime.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            {seasonChip && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-orange-500/95 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {seasonChip}
              </div>
            )}
            {anime.type && (
              <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
                {anime.type}
              </div>
            )}
          </div>
        )}

        <div className="p-6 pt-4">
          <div className="flex items-start gap-2 mb-2">
            <CalendarClock className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
            <h3 className="text-xl font-bold text-foreground leading-tight">{anime.title}</h3>
          </div>

          {/* Headline: which season + when */}
          <div className="mb-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-orange-400 text-sm font-bold leading-tight">
              {headlineSeason ? `Season ${headlineSeason} releasing` : 'Releasing'}
              {target.source === 'season' ? ' on' : ''}
            </p>
            <p className="text-foreground text-base font-bold mt-0.5">{releaseDateLabel}</p>
            {seasons && seasons.length > 1 && (
              <p className="text-muted-foreground text-xs mt-1">
                Multiple new seasons confirmed: {seasonChip}
              </p>
            )}
          </div>

          {/* Quick meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            {anime.release_year && (
              <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 font-semibold">
                {anime.release_year}
              </span>
            )}
            {seasons && seasons.map((n) => (
              <span key={n} className="px-2 py-0.5 rounded bg-primary/15 text-primary font-semibold flex items-center gap-1">
                <Film className="h-3 w-3" /> Season {n}
              </span>
            ))}
          </div>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {anime.genres.slice(0, 6).map((g) => (
                <span key={g} className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {anime.description ? (
            <p className="text-muted-foreground text-sm mb-4 line-clamp-4 leading-relaxed">
              {anime.description}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
              {headlineSeason
                ? `Get ready — Season ${headlineSeason} of ${anime.title} is on the way${target.source === 'season' ? ` and lands on ${releaseDateLabel}` : ''}. Add it to your watchlist so you don't miss the premiere drop.`
                : `${anime.title} is officially confirmed${target.source === 'season' ? ` for ${releaseDateLabel}` : ` for ${anime.release_year || 'a future date'}`}. Stay tuned for trailers, episode counts and the official streaming announcement.`}
            </p>
          )}

          {/* Countdown DD:HH:MM:SS */}
          {t.expired ? (
            <div className="text-center py-3 mb-4 bg-primary/10 rounded-lg">
              <p className="text-primary font-bold">It's release day! 🎉</p>
              <p className="text-muted-foreground text-xs mt-1">Episodes should be available very soon.</p>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 text-center">
                Live countdown
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Days', value: t.days },
                  { label: 'Hours', value: t.hours },
                  { label: 'Minutes', value: t.minutes },
                  { label: 'Seconds', value: t.seconds },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="bg-muted rounded-lg py-3 px-1">
                      <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
                        {String(item.value).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium mt-1 block uppercase tracking-wider">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleNotify}
              variant={isSubscribed ? 'default' : 'outline'}
              className="flex-1 gap-2"
            >
              {isSubscribed ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {isSubscribed ? 'Notifying' : 'Notify me'}
            </Button>
            <Button onClick={onClose} variant="secondary" className="flex-1">
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
