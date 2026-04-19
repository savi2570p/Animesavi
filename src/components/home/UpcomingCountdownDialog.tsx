import { useState, useEffect } from 'react';
import { CalendarClock, X, Tag, Film, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

interface UpcomingCountdownDialogProps {
  anime: UpcomingAnime | null;
  onClose: () => void;
}

function getTargetDate(releaseYear: number | null): Date {
  const year = releaseYear || new Date().getFullYear() + 1;
  return new Date(year, 0, 1, 0, 0, 0);
}

function getTimeRemaining(targetDate: Date) {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  const years = Math.floor(totalDays / 365);
  const remainingDaysAfterYears = totalDays % 365;
  const months = Math.floor(remainingDaysAfterYears / 30);
  const days = remainingDaysAfterYears % 30;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  return { years, months, days, hours, minutes, seconds, expired: false };
}

export function UpcomingCountdownDialog({ anime, onClose }: UpcomingCountdownDialogProps) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(new Date()));

  useEffect(() => {
    if (!anime) return;

    const targetDate = getTargetDate(anime.release_year);
    setTimeRemaining(getTimeRemaining(targetDate));

    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [anime]);

  if (!anime) return null;

  const t = timeRemaining;
  const seasons = anime.upcoming_seasons && anime.upcoming_seasons.length > 0
    ? anime.upcoming_seasons
    : null;
  const seasonChip = seasons ? seasons.map(n => `S${n}`).join(' · ') : null;

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
            <p className="text-muted-foreground text-sm mb-4">
              {seasons
                ? `New ${seasons.length > 1 ? 'seasons' : 'season'} coming${anime.release_year ? ` in ${anime.release_year}` : ' soon'}.`
                : `Anime episodes coming${anime.release_year ? ` from ${anime.release_year}` : ' soon'}.`}
            </p>
          )}

          {/* Countdown */}
          {t.expired ? (
            <div className="text-center py-3 mb-4 bg-primary/10 rounded-lg">
              <p className="text-primary font-bold">Release period has started!</p>
              <p className="text-muted-foreground text-xs mt-1">Episodes will be available soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 mb-4">
              {[
                { label: 'YR', value: t.years },
                { label: 'MO', value: t.months },
                { label: 'DD', value: t.days },
                { label: 'HH', value: t.hours },
                { label: 'MM', value: t.minutes },
                { label: 'SS', value: t.seconds },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="bg-muted rounded-lg py-2 px-1">
                    <span className="text-lg font-mono font-bold text-foreground">
                      {String(item.value).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium mt-1 block uppercase tracking-wider">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
