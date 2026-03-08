import { useState, useEffect } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpcomingAnime {
  id: string;
  title: string;
  cover_image: string | null;
  release_year: number | null;
  created_at: string;
  type: string | null;
}

interface UpcomingCountdownDialogProps {
  anime: UpcomingAnime | null;
  onClose: () => void;
}

function getTargetDate(releaseYear: number | null): Date {
  const year = releaseYear || new Date().getFullYear() + 1;
  // Default to Jan 1 of the release year
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Cover image */}
        {anime.cover_image && (
          <div className="w-full h-40 rounded-lg overflow-hidden mb-4">
            <img
              src={anime.cover_image}
              alt={anime.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-bold text-foreground line-clamp-1">{anime.title}</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-5">
          Anime episodes coming from{anime.release_year ? ` ${anime.release_year}` : ''}
        </p>

        {t.expired ? (
          <div className="text-center py-4">
            <p className="text-primary font-bold text-lg">Release period has started!</p>
            <p className="text-muted-foreground text-sm mt-1">Episodes will be available soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2 mb-5">
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
                  <span className="text-xl font-mono font-bold text-foreground">
                    {String(item.value).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium mt-1 block">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={onClose} className="w-full">
          OK
        </Button>
      </div>
    </div>
  );
}
