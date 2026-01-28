import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarClock, Bell, Loader2, RefreshCw, Clock, Calendar } from 'lucide-react';
import { useReleaseSchedule } from '@/hooks/useReleaseSchedule';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteAnime {
  anime_id: string;
  anime: {
    id: string;
    title: string;
    cover_image: string | null;
    status: string | null;
  };
}

export function ReleaseReminderSettings() {
  const { user } = useAuth();
  const {
    schedules,
    reminders,
    isAnalyzing,
    analyzeReleasePattern,
    analyzeAllFavorites,
    setReminder,
    getSchedule,
    getReminder,
    formatSchedule,
  } = useReleaseSchedule();

  const [favorites, setFavorites] = useState<FavoriteAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_favorites')
        .select(`
          anime_id,
          anime:anime_id (
            id,
            title,
            cover_image,
            status
          )
        `)
        .eq('user_id', user.id);

      if (data) {
        setFavorites(data as unknown as FavoriteAnime[]);
      }
      setIsLoading(false);
    };

    fetchFavorites();
  }, [user]);

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Release Reminders
          </CardTitle>
          <CardDescription>
            Sign in to set up release reminders for your favorite anime.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Release Reminders
        </CardTitle>
        <CardDescription>
          Get notified when new episodes are expected based on release patterns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Analyze All Button */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Analyze Release Patterns</Label>
            <p className="text-xs text-muted-foreground">
              Detect when your favorite anime typically releases new episodes
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeAllFavorites}
            disabled={isAnalyzing || isLoading}
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Analyze All'}
          </Button>
        </div>

        <Separator />

        {/* Favorites List with Reminders */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No favorites yet</p>
            <p className="text-xs">Add anime to your favorites to set reminders</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {favorites.map(({ anime_id, anime }) => {
                const schedule = getSchedule(anime_id);
                const reminder = getReminder(anime_id);
                const isOngoing = anime.status?.toLowerCase() === 'ongoing';

                return (
                  <div
                    key={anime_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    {/* Cover Image */}
                    {anime.cover_image && (
                      <img
                        src={anime.cover_image}
                        alt={anime.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{anime.title}</p>
                      
                      {schedule ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatSchedule(schedule)}
                          </span>
                          {schedule.confidence > 0.7 && (
                            <Badge variant="secondary" className="text-xs">
                              High confidence
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Pattern not analyzed
                          </span>
                        </div>
                      )}

                      {!isOngoing && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {anime.status || 'Unknown'}
                        </Badge>
                      )}
                    </div>

                    {/* Reminder Toggle */}
                    <div className="flex flex-col items-end gap-1">
                      {schedule && isOngoing ? (
                        <Switch
                          checked={reminder?.enabled || false}
                          onCheckedChange={(checked) => setReminder(anime_id, checked)}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => analyzeReleasePattern(anime_id)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Analyze'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Info Note */}
        <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          💡 Release patterns are detected based on historical episode uploads. 
          Reminders work best for ongoing anime with consistent release schedules.
        </p>
      </CardContent>
    </Card>
  );
}
