import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Clock, Film, Heart, TrendingUp, Calendar, Eye, Award } from 'lucide-react';

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
    <div className="container py-8 max-w-4xl">
      {/* Profile Header */}
      <div className="flex items-center gap-6 mb-8">
        <Avatar className="h-24 w-24 ring-4 ring-primary/30">
          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || 'User'} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-3xl text-white">
            {profile?.username?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-heading font-bold">
            {profile?.username || 'Anime Fan'}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <Calendar className="h-4 w-4" />
            <span>Member since {profile?.created_at ? formatDate(profile.created_at) : 'Unknown'}</span>
          </div>
          <div className="flex gap-2 mt-3">
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" />
              {stats?.totalAnimeStarted || 0} Anime
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3" />
              {reviews.length} Reviews
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalEpisodesWatched || 0}</p>
                <p className="text-xs text-muted-foreground">Episodes Watched</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(stats?.totalMinutesWatched || 0)}</p>
                <p className="text-xs text-muted-foreground">Watch Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.completedAnime || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/20 to-secondary/10 border-secondary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <TrendingUp className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.averageWatchProgress || 0}%</p>
                <p className="text-xs text-muted-foreground">Avg Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Genres and Reviews */}
      <Tabs defaultValue="genres" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="genres" className="gap-2">
            <Heart className="h-4 w-4" />
            Favorite Genres
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2">
            <Star className="h-4 w-4" />
            Reviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="genres" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Favorite Genres</CardTitle>
              <CardDescription>Based on your watch history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {genres.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Start watching anime to see your genre preferences!
                </p>
              ) : (
                genres.map((genre, index) => (
                  <div key={genre.genre} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">#{index + 1}</span>
                        <span className="font-medium">{genre.genre}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {genre.watch_count} {genre.watch_count === 1 ? 'watch' : 'watches'}
                      </span>
                    </div>
                    <Progress 
                      value={(genre.watch_count / getMaxGenreCount()) * 100} 
                      className="h-2" 
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Reviews</CardTitle>
              <CardDescription>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} written</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  You haven't written any reviews yet. Share your thoughts on anime you've watched!
                </p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="flex gap-4 p-4 rounded-lg bg-muted/50">
                    <img
                      src={review.anime.cover_image || '/placeholder.svg'}
                      alt={review.anime.title}
                      className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{review.anime.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {review.review_text}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
