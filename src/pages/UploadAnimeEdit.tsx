import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Film, Tv, ArrowLeft } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';

interface Anime {
  id: string;
  title: string;
  description: string | null;
  uploader_id: string | null;
}

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  anime_id: string;
}

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  external_url: string | null;
  thumbnail: string | null;
  duration: number | null;
  season_id: string;
}

export default function UploadAnimeEdit() {
  const { animeId } = useParams<{ animeId: string }>();
  const { user, isUploader, isAdmin, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthReady = !isAuthLoading && isRolesLoaded;

  // New season form
  const [newSeasonTitle, setNewSeasonTitle] = useState('');

  // New episode form
  const [newEpisodeTitle, setNewEpisodeTitle] = useState('');
  const [newEpisodeDescription, setNewEpisodeDescription] = useState('');
  const [newEpisodeVideoUrl, setNewEpisodeVideoUrl] = useState('');
  const [newEpisodeExternalUrl, setNewEpisodeExternalUrl] = useState('');
  const [newEpisodeThumbnail, setNewEpisodeThumbnail] = useState('');
  const [newEpisodeDuration, setNewEpisodeDuration] = useState('');

  useEffect(() => {
    // Wait for auth + roles to be fully loaded before enforcing redirects
    if (!isAuthReady) return;

    // Check if user has code verification
    const isCodeVerified = sessionStorage.getItem('upload_code_verified') === 'true';

    if (!user && !isCodeVerified) {
      navigate('/');
      return;
    }

    // Allow access if code is verified OR user is an uploader
    if (!isCodeVerified && !isUploader) {
      navigate('/');
      return;
    }

    fetchAnimeData();
  }, [isAuthReady, user, isUploader, animeId, navigate]);

  useEffect(() => {
    if (selectedSeason) {
      fetchEpisodes(selectedSeason);
    }
  }, [selectedSeason]);

  const fetchAnimeData = async () => {
    const { data: animeData, error } = await supabase
      .from('anime')
      .select('*')
      .eq('id', animeId)
      .single();

    if (error || !animeData) {
      toast.error('Anime not found');
      navigate('/upload');
      return;
    }

    // Check ownership or code verification
    const isCodeVerified = sessionStorage.getItem('upload_code_verified') === 'true';
    if (!isCodeVerified && animeData.uploader_id !== user?.id && !isAdmin) {
      toast.error('You do not have permission to edit this anime');
      navigate('/upload');
      return;
    }

    setAnime(animeData);

    // Fetch seasons
    const { data: seasonsData } = await supabase
      .from('seasons')
      .select('*')
      .eq('anime_id', animeId)
      .order('season_number');

    if (seasonsData) {
      setSeasons(seasonsData);
      if (seasonsData.length > 0) {
        setSelectedSeason(seasonsData[0].id);
      }
    }

    setIsLoading(false);
  };

  const fetchEpisodes = async (seasonId: string) => {
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('season_id', seasonId)
      .order('episode_number');

    if (data) {
      setEpisodes(data);
    }
  };

  const handleAddSeason = async () => {
    const nextSeasonNumber = seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number)) + 1 : 1;

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        anime_id: animeId,
        season_number: nextSeasonNumber,
        title: newSeasonTitle.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add season');
    } else {
      toast.success('Season added');
      setNewSeasonTitle('');
      setSeasons([...seasons, data]);
      setSelectedSeason(data.id);
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Delete this season and all its episodes?')) return;

    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);

    if (error) {
      toast.error('Failed to delete season');
    } else {
      toast.success('Season deleted');
      setSeasons(seasons.filter((s) => s.id !== seasonId));
      setSelectedSeason(seasons.length > 1 ? seasons[0].id : null);
    }
  };

  const handleAddEpisode = async () => {
    if (!selectedSeason || !newEpisodeTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    const nextEpisodeNumber = episodes.length > 0 ? Math.max(...episodes.map((e) => e.episode_number)) + 1 : 1;

    const { data, error } = await supabase
      .from('episodes')
      .insert({
        season_id: selectedSeason,
        episode_number: nextEpisodeNumber,
        title: newEpisodeTitle.trim(),
        description: newEpisodeDescription.trim() || null,
        video_url: newEpisodeVideoUrl.trim() || null,
        external_url: newEpisodeExternalUrl.trim() || null,
        thumbnail: newEpisodeThumbnail.trim() || null,
        duration: newEpisodeDuration ? parseInt(newEpisodeDuration) : null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add episode');
    } else {
      toast.success('Episode added');
      // Reset form
      setNewEpisodeTitle('');
      setNewEpisodeDescription('');
      setNewEpisodeVideoUrl('');
      setNewEpisodeExternalUrl('');
      setNewEpisodeThumbnail('');
      setNewEpisodeDuration('');
      // Add to list
      setEpisodes([...episodes, data]);
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm('Delete this episode?')) return;

    const { error } = await supabase.from('episodes').delete().eq('id', episodeId);

    if (error) {
      toast.error('Failed to delete episode');
    } else {
      toast.success('Episode deleted');
      setEpisodes(episodes.filter((e) => e.id !== episodeId));
    }
  };

  if (!isAuthReady || isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Button variant="ghost" onClick={() => navigate('/upload')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">
          Edit: <span className="anime-gradient-text">{anime?.title}</span>
        </h1>
        <p className="text-muted-foreground">Manage seasons and episodes</p>
      </div>

      <Tabs defaultValue="seasons">
        <TabsList className="mb-8">
          <TabsTrigger value="seasons">Seasons</TabsTrigger>
          <TabsTrigger value="episodes" disabled={seasons.length === 0}>
            Episodes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seasons">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Existing Seasons */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="h-5 w-5" />
                  Seasons ({seasons.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {seasons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No seasons yet. Add one to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {seasons.map((season) => (
                      <div
                        key={season.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <span>
                          Season {season.season_number}
                          {season.title && ` - ${season.title}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSeason(season.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Season */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Season
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seasonTitle">Season Title (Optional)</Label>
                  <Input
                    id="seasonTitle"
                    placeholder="e.g., The Beginning"
                    value={newSeasonTitle}
                    onChange={(e) => setNewSeasonTitle(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>
                <Button onClick={handleAddSeason} className="anime-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Season
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="episodes">
          {seasons.length > 1 && (
            <div className="mb-6">
              <Label>Select Season</Label>
              <div className="flex gap-2 mt-2">
                {seasons.map((season) => (
                  <Button
                    key={season.id}
                    variant={selectedSeason === season.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSeason(season.id)}
                  >
                    Season {season.season_number}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Existing Episodes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  Episodes ({episodes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {episodes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No episodes yet. Add one below.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {episodes.map((episode) => (
                      <div
                        key={episode.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {episode.thumbnail && (
                            <img 
                              src={episode.thumbnail} 
                              alt={episode.title}
                              className="w-16 h-10 object-cover rounded"
                            />
                          )}
                          <div>
                            <span className="text-sm text-muted-foreground">
                              EP {episode.episode_number}:
                            </span>
                            <span className="ml-2 font-medium">{episode.title}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEpisode(episode.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Episode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Episode
                </CardTitle>
                <CardDescription>
                  Upload a video file or add external link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="episodeTitle">Title *</Label>
                  <Input
                    id="episodeTitle"
                    placeholder="Episode title"
                    value={newEpisodeTitle}
                    onChange={(e) => setNewEpisodeTitle(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="episodeDescription">Description</Label>
                  <Textarea
                    id="episodeDescription"
                    placeholder="Brief description..."
                    value={newEpisodeDescription}
                    onChange={(e) => setNewEpisodeDescription(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <FileUploadInput
                  label="Episode Video"
                  accept="video"
                  value={newEpisodeVideoUrl}
                  onChange={setNewEpisodeVideoUrl}
                  folder={`anime/${animeId}/episodes`}
                  placeholder="https://example.com/video.mp4"
                />

                <div className="space-y-2">
                  <Label htmlFor="externalUrl">External Link (Alternative)</Label>
                  <Input
                    id="externalUrl"
                    type="url"
                    placeholder="https://example.com/watch/episode"
                    value={newEpisodeExternalUrl}
                    onChange={(e) => setNewEpisodeExternalUrl(e.target.value)}
                    className="bg-muted/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FileUploadInput
                    label="Thumbnail"
                    accept="image"
                    value={newEpisodeThumbnail}
                    onChange={setNewEpisodeThumbnail}
                    folder={`anime/${animeId}/thumbnails`}
                    placeholder="https://..."
                  />
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      placeholder="24"
                      value={newEpisodeDuration}
                      onChange={(e) => setNewEpisodeDuration(e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <Button onClick={handleAddEpisode} className="anime-button w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Episode
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
