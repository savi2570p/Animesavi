import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Star, Clock, Film, Heart, TrendingUp, Calendar, Eye, Award } from 'lucide-react';

interface UserProfile {
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface GenrePreference {
  genre: string;
  watch_count: number;
}

interface WatchStats {
  totalEpisodesWatched: number;
  totalMinutesWatched: number;
  completedAnime: number;
  totalAnimeStarted: number;
  averageWatchProgress: number;
}

interface UserReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  anime: {
    id: string;
    title: string;
    cover_image: string | null;
  };
}

export default function UserStats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [genres, setGenres] = useState<GenrePreference[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchAllData();
  }, [user, navigate]);

  const fetchAllData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url, created_at')
        .eq('id', user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Fetch genre preferences
      const { data: genreData } = await supabase
        .from('user_genre_preferences')
        .select('genre, watch_count')
        .eq('user_id', user.id)
        .order('watch_count', { ascending: false })
        .limit(10);

      if (genreData) setGenres(genreData);

      // Fetch watch history for stats
      const { data: historyData } = await supabase
        .from('watch_history')
        .select('id, progress, completed, anime_id, episode_id, last_position, duration')
        .eq('user_id', user.id);

      if (historyData) {
        // Fetch episode durations
        const episodeIds = [...new Set(historyData.map(h => h.episode_id))];
        const { data: episodesData } = await supabase
          .from('episodes')
          .select('id, duration')
          .in('id', episodeIds);

        const episodeDurations = new Map(episodesData?.map(e => [e.id, e.duration || 0]) || []);
        
        let totalMinutes = 0;
        historyData.forEach(h => {
          const savedSeconds = h.last_position && h.last_position > 0 ? h.last_position : 0;
          const savedDurationSeconds = h.duration && h.duration > 0 ? h.duration : 0;
          const episodeDurationMinutes = episodeDurations.get(h.episode_id) || 0;
          const watchedSeconds = savedSeconds || (
            savedDurationSeconds > 0 && h.progress
              ? (h.completed ? savedDurationSeconds : ((h.progress || 0) / 100) * savedDurationSeconds)
              : episodeDurationMinutes > 0 && h.progress
                ? ((h.progress || 0) / 100) * episodeDurationMinutes * 60
                : 0
          );
          const watchedMinutes = watchedSeconds / 60;
          totalMinutes += watchedMinutes;
        });

        const uniqueAnime = [...new Set(historyData.map(h => h.anime_id))];
        const completedCount = historyData.filter(h => h.completed).length;
        const avgProgress = historyData.length > 0
          ? historyData.reduce((sum, h) => sum + (h.progress || 0), 0) / historyData.length
          : 0;

        // Count unique anime that are completed (all episodes watched)
        const animeEpisodeCounts = new Map<string, { total: number; completed: number }>();
        historyData.forEach(h => {
          const existing = animeEpisodeCounts.get(h.anime_id) || { total: 0, completed: 0 };
          existing.total++;
          if (h.completed) existing.completed++;
          animeEpisodeCounts.set(h.anime_id, existing);
        });

        setStats({
          totalEpisodesWatched: historyData.length,
          totalMinutesWatched: Math.round(totalMinutes),
          completedAnime: [...animeEpisodeCounts.values()].filter(v => v.completed > 0).length,
          totalAnimeStarted: uniqueAnime.length,
          averageWatchProgress: Math.round(avgProgress),
        });
      }

      // Fetch user reviews
      const { data: reviewsData } = await supabase
        .from('anime_reviews')
        .select('id, rating, review_text, created_at, anime_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewsData && reviewsData.length > 0) {
        const animeIds = reviewsData.map(r => r.anime_id);
        const { data: animeData } = await supabase
          .from('anime')
          .select('id, title, cover_image')
          .in('id', animeIds);

        const animeMap = new Map(animeData?.map(a => [a.id, a]) || []);

        const reviewsWithAnime = reviewsData.map(r => ({
          id: r.id,
          rating: r.rating,
          review_text: r.review_text,
          created_at: r.created_at,
          anime: animeMap.get(r.anime_id) || { id: r.anime_id, title: 'Unknown', cover_image: null },
        }));

        setReviews(reviewsWithAnime);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMaxGenreCount = () => {
    return genres.length > 0 ? Math.max(...genres.map(g => g.watch_count)) : 1;
  };

  if (isLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stats-v12 account-v4 min-h-screen">
      <header className="stats-v12-header border-b border-border">
        <div className="container max-w-5xl py-8 md:py-12">
          <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="mb-6"><ArrowLeft className="h-4 w-4" />My Profile</Button>
          <div className="flex items-center gap-4 md:gap-6">
            <Avatar className="h-16 w-16 md:h-20 md:w-20 shrink-0 ring-2 ring-border">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || 'User'} />
              <AvatarFallback className="bg-primary/15 text-primary text-2xl">{profile?.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-2 truncate">{profile?.username || 'Anime Fan'}</p>
              <h1 className="font-heading text-3xl md:text-4xl font-bold">Watch Stats</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-3 text-xs"><Calendar className="h-3.5 w-3.5 shrink-0" /><span>Member since {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}</span></div>
            </div>
          </div>
        </div>
      </header>
      <div className="container max-w-5xl py-6 md:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Film, value: stats?.totalEpisodesWatched || 0, label: 'Episodes watched', tone: 'episodes' },
            { icon: Clock, value: formatDuration(stats?.totalMinutesWatched || 0), label: 'Watch time', tone: 'time' },
            { icon: Award, value: stats?.completedAnime || 0, label: 'Anime with completions', tone: 'completed' },
            { icon: TrendingUp, value: `${stats?.averageWatchProgress || 0}%`, label: 'Average progress', tone: 'progress' },
          ].map(metric => <div key={metric.label} className="stats-v12-metric" data-tone={metric.tone}>
            <metric.icon className="h-5 w-5 mb-5" /><strong className="block text-2xl md:text-3xl font-bold tabular-nums break-words">{metric.value}</strong><span className="block text-xs text-muted-foreground mt-2">{metric.label}</span>
          </div>)}
        </div>
        <div className="flex flex-wrap items-center gap-5 border-y border-border py-4 mb-8 text-sm">
          <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><strong>{stats?.totalAnimeStarted || 0}</strong><span className="text-muted-foreground">Anime started</span></span>
          <span className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /><strong>{reviews.length}</strong><span className="text-muted-foreground">Reviews</span></span>
        </div>
        <Tabs defaultValue="genres" className="space-y-6">
          <TabsList className="stats-v12-tabs"><TabsTrigger value="genres" className="gap-2"><Heart className="h-4 w-4" />Favorite Genres</TabsTrigger><TabsTrigger value="reviews" className="gap-2"><Star className="h-4 w-4" />Reviews</TabsTrigger></TabsList>
          <TabsContent value="genres">
            <section className="py-2">
              <h2 className="text-xl font-bold mb-6">Your Favorite Genres</h2>
              {genres.length === 0 ? <p className="text-muted-foreground py-10 text-sm">No viewing preferences yet.</p> : <div className="space-y-5">{genres.map((genre, index) => <div key={genre.genre} className="stats-v12-genre">
                <div className="flex items-center justify-between gap-3 mb-2"><div className="flex items-center gap-3 min-w-0"><span className="text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}</span><span className="text-sm font-medium break-words">{genre.genre}</span></div><span className="text-xs text-muted-foreground shrink-0">{genre.watch_count} {genre.watch_count === 1 ? 'watch' : 'watches'}</span></div>
                <Progress value={(genre.watch_count / getMaxGenreCount()) * 100} className="h-1.5" />
              </div>)}</div>}
            </section>
          </TabsContent>
          <TabsContent value="reviews">
            <section className="py-2">
              <h2 className="text-xl font-bold mb-6">Your Reviews</h2>
              {reviews.length === 0 ? <p className="text-muted-foreground py-10 text-sm">No reviews yet.</p> : <div className="grid md:grid-cols-2 gap-3">{reviews.map(review => <article key={review.id} className="stats-v12-review flex gap-3 p-4">
                <img src={review.anime.cover_image || '/placeholder.svg'} alt={review.anime.title} className="w-16 h-24 object-contain bg-background rounded shrink-0" loading="lazy" />
                <div className="min-w-0"><h3 className="text-sm font-semibold line-clamp-2">{review.anime.title}</h3><div className="flex items-center gap-0.5 mt-2" aria-label={`${review.rating} out of 5 stars`}>{Array.from({length: 5}, (_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? 'text-primary fill-current' : 'text-muted-foreground'}`} />)}</div><p className="text-[11px] text-muted-foreground mt-2">{formatDate(review.created_at)}</p>{review.review_text && <p className="text-xs text-muted-foreground mt-3 line-clamp-3 break-words">{review.review_text}</p>}</div>
              </article>)}</div>}
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
