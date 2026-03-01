import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

interface ScheduleAnime {
  id: string;
  title: string;
  cover_image: string | null;
  status: string | null;
  updated_at: string;
  genres: string[] | null;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Schedule() {
  const [animeList, setAnimeList] = useState<ScheduleAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));

  useEffect(() => {
    fetchOngoingAnime();
  }, []);

  const fetchOngoingAnime = async () => {
    setIsLoading(true);
    
    // 1. Get all ongoing anime
    const { data: ongoingAnime } = await supabase
      .from('anime_public')
      .select('id, title, cover_image, status, updated_at, genres')
      .eq('status', 'ongoing')
      .order('updated_at', { ascending: false });

    if (!ongoingAnime || ongoingAnime.length === 0) {
      setAnimeList([]);
      setIsLoading(false);
      return;
    }

    // 2. Get seasons for these anime to find which have episodes
    const animeIds = ongoingAnime.map(a => a.id).filter(Boolean) as string[];
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id, anime_id')
      .in('anime_id', animeIds);

    const seasonIds = (seasons || []).map(s => s.id);
    const seasonToAnime = new Map((seasons || []).map(s => [s.id, s.anime_id]));
    const animeWithEpisodes = new Set<string>();

    if (seasonIds.length > 0) {
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: episodeBatch } = await supabase
          .from('episodes')
          .select('season_id')
          .in('season_id', seasonIds)
          .range(offset, offset + pageSize - 1);
        (episodeBatch || []).forEach(ep => {
          const animeId = seasonToAnime.get(ep.season_id);
          if (animeId) animeWithEpisodes.add(animeId);
        });
        hasMore = (episodeBatch?.length || 0) === pageSize;
        offset += pageSize;
      }
    }

    // 3. Only show anime that actually have episodes (exclude pending upload / zero episodes)
    const filtered = ongoingAnime.filter(a => a.id && animeWithEpisodes.has(a.id));
    setAnimeList(filtered);
    setIsLoading(false);
  };

  // Distribute anime across days based on their updated_at date
  const getAnimeForDay = (dayIndex: number) => {
    return animeList.filter((anime) => {
      const hash = (anime.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return hash % 7 === dayIndex;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'next' ? 7 : -7;
    setWeekStart(addDays(weekStart, days));
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  if (isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold">
            Anime <span className="text-primary">Schedule</span>
          </h1>
        </div>
        <p className="text-muted-foreground">
          Weekly release calendar for ongoing anime series
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6 bg-card/50 backdrop-blur rounded-xl p-4 border border-border/50">
        <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {weekDates.map((date, index) => {
            const isToday = isSameDay(date, today);
            const isSelected = selectedDay === index;
            const animeCount = getAnimeForDay(index).length;
            
            return (
              <button
                key={index}
                onClick={() => setSelectedDay(index)}
                className={`flex flex-col items-center min-w-[60px] md:min-w-[80px] p-2 md:p-3 rounded-xl transition-all ${
                  isSelected 
                    ? 'bg-primary text-primary-foreground' 
                    : isToday 
                      ? 'bg-primary/20 text-primary' 
                      : 'hover:bg-muted'
                }`}
              >
                <span className="text-xs font-medium">
                  {DAYS_OF_WEEK[index].slice(0, 3)}
                </span>
                <span className="text-lg font-bold">{format(date, 'd')}</span>
                {animeCount > 0 && (
                  <span className={`text-xs mt-1 px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary'
                  }`}>
                    {animeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Selected Day Content */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            {DAYS_OF_WEEK[selectedDay]} - {format(weekDates[selectedDay], 'MMM d, yyyy')}
          </h2>
        </div>

        {getAnimeForDay(selectedDay).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No releases scheduled</h3>
              <p className="text-muted-foreground">
                Check back later for updates on this day
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {getAnimeForDay(selectedDay).map((anime) => (
              <Link key={anime.id} to={`/anime/${anime.id}`}>
                <Card className="group overflow-hidden hover:border-primary/50 transition-all duration-300">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img
                      src={anime.cover_image || '/placeholder.svg'}
                      alt={anime.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="h-14 w-14 rounded-full bg-primary/90 backdrop-blur flex items-center justify-center shadow-lg">
                        <Play className="h-6 w-6 text-primary-foreground ml-1" />
                      </div>
                    </div>
                    
                    {/* Status badge */}
                    <Badge className="absolute top-2 right-2 bg-primary/90">
                      Ongoing
                    </Badge>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {anime.title}
                    </h3>
                    {anime.genres && anime.genres.length > 0 && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {anime.genres.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* All Ongoing Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">All Ongoing Series</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {animeList.map((anime) => (
            <Link key={anime.id} to={`/anime/${anime.id}`}>
              <Card className="group overflow-hidden hover:border-primary/50 transition-all">
                <CardContent className="flex items-center gap-3 p-3">
                  <img
                    src={anime.cover_image || '/placeholder.svg'}
                    alt={anime.title}
                    className="w-14 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {anime.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(anime.updated_at), 'MMM d')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
