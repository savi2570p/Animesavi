import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, X, Tag, Film, Sparkles, Bell, BellRing, Building2, Hash, BookOpen, ShieldCheck, Clapperboard } from 'lucide-react';
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
    <div className="fixed inset-0 z-[9999] flex items-end justify-center overflow-y-auto bg-black/80 p-3 sm:items-center sm:p-4">
      <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-scale-in max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        {/* Cinematic hero — banner preferred, fallback to cover */}
        {(anime.banner_image || anime.cover_image) && (
          <div className="relative w-full h-56 overflow-hidden">
            <img
              src={anime.banner_image || anime.cover_image!}
              alt={anime.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />

            {/* Floating cover thumbnail */}
            {anime.banner_image && anime.cover_image && (
              <img
                src={anime.cover_image}
                alt=""
                className="absolute bottom-3 left-3 w-16 h-24 rounded-md object-cover shadow-2xl border-2 border-card"
              />
            )}

            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {seasonChip && (
                <div className="px-2.5 py-1 rounded-full bg-orange-500/95 text-white text-xs font-bold shadow-lg flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {seasonChip}
                </div>
              )}
              <div className="px-2.5 py-1 rounded-full bg-card/80 backdrop-blur text-foreground text-[10px] font-bold uppercase tracking-wider">
                Upcoming
              </div>
            </div>

            {anime.content_rating && (
              <div className="absolute top-3 right-12 px-2 py-0.5 rounded bg-red-600/90 text-white text-[10px] font-black tracking-wider">
                {anime.content_rating}
              </div>
            )}

            {anime.type && (
              <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
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
          <div className="mb-3 rounded-lg border border-orange-500/20 bg-orange-500/10 p-3">
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

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-bold text-foreground">{anime.status || 'Upcoming'}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Episodes</p>
              <p className="mt-1 text-sm font-bold text-foreground">{anime.total_episodes || 'TBA'}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Studio</p>
              <p className="mt-1 text-sm font-bold text-foreground truncate">{anime.studio || 'TBA'}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
              <p className="mt-1 text-sm font-bold text-foreground truncate">{anime.source_material || 'Original / TBA'}</p>
            </div>
          </div>

          {/* Rich metadata grid */}
          {(anime.studio || anime.total_episodes || anime.source_material || anime.content_rating) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {anime.studio && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Studio</p>
                    <p className="text-xs font-bold text-foreground truncate">{anime.studio}</p>
                  </div>
                </div>
              )}
              {anime.total_episodes && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Hash className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Episodes</p>
                    <p className="text-xs font-bold text-foreground truncate">{anime.total_episodes}</p>
                  </div>
                </div>
              )}
              {anime.source_material && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Source</p>
                    <p className="text-xs font-bold text-foreground truncate">{anime.source_material}</p>
                  </div>
                </div>
              )}
              {anime.content_rating && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Rating</p>
                    <p className="text-xs font-bold text-foreground truncate">{anime.content_rating}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            {anime.release_year && (
              <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 font-semibold flex items-center gap-1">
                <Clapperboard className="h-3 w-3" /> {anime.release_year}
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
          {target.date && t.expired ? (
            <div className="text-center py-3 mb-4 bg-primary/10 rounded-lg">
              <p className="text-primary font-bold">It's release day! 🎉</p>
              <p className="text-muted-foreground text-xs mt-1">Episodes should be available very soon.</p>
            </div>
          ) : target.date ? (
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
          ) : (
            <div className="text-center py-3 mb-4 bg-muted rounded-lg">
              <p className="text-foreground font-semibold">Release date announce soon</p>
              <p className="text-muted-foreground text-xs mt-1">We will show the live countdown as soon as an exact date is added.</p>
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
            <Button onClick={onClose} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
