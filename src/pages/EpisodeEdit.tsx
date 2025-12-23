import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Save, Film } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';

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

interface Anime {
  id: string;
  title: string;
  uploader_id: string | null;
}

export default function EpisodeEdit() {
  const { animeId, episodeId } = useParams<{ animeId: string; episodeId: string }>();
  const { user, isAdmin, isUploader, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isAuthReady = !isAuthLoading && isRolesLoaded;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [duration, setDuration] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');

  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isAdmin && !isUploader) {
      toast.error('You do not have permission to edit episodes');
      navigate('/');
      return;
    }

    fetchData();
  }, [isAuthReady, user, isAdmin, isUploader, animeId, episodeId, navigate]);

  const fetchData = async () => {
    // Fetch anime
    const { data: animeData, error: animeError } = await supabase
      .from('anime')
      .select('id, title, uploader_id')
      .eq('id', animeId)
      .single();

    if (animeError || !animeData) {
      toast.error('Anime not found');
      navigate('/');
      return;
    }

    // Check permission
    if (!isAdmin && animeData.uploader_id !== user?.id) {
      toast.error('You do not have permission to edit this episode');
      navigate('/');
      return;
    }

    setAnime(animeData);

    // Fetch episode
    const { data: episodeData, error: episodeError } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (episodeError || !episodeData) {
      toast.error('Episode not found');
      navigate(`/upload/anime/${animeId}`);
      return;
    }

    setEpisode(episodeData);

    // Populate form
    setTitle(episodeData.title);
    setDescription(episodeData.description || '');
    setVideoUrl(episodeData.video_url || '');
    setExternalUrl(episodeData.external_url || '');
    setThumbnail(episodeData.thumbnail || '');
    setDuration(episodeData.duration?.toString() || '');
    setEpisodeNumber(episodeData.episode_number.toString());

    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from('episodes')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim() || null,
        external_url: externalUrl.trim() || null,
        thumbnail: thumbnail.trim() || null,
        duration: duration ? parseInt(duration) : null,
        episode_number: parseInt(episodeNumber),
      })
      .eq('id', episodeId);

    if (error) {
      toast.error('Failed to update episode');
    } else {
      toast.success('Episode updated successfully');
      navigate(`/upload/anime/${animeId}`);
    }

    setIsSaving(false);
  };

  if (!isAuthReady || isLoading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate(`/upload/anime/${animeId}`)} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Anime
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold mb-2">
          Edit <span className="anime-gradient-text">Episode</span>
        </h1>
        <p className="text-muted-foreground">
          {anime?.title} - Episode {episode?.episode_number}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Episode Details
          </CardTitle>
          <CardDescription>
            Update the episode information below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="episodeNumber">Episode Number *</Label>
              <Input
                id="episodeNumber"
                type="number"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="24"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Episode title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the episode..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/50 min-h-[100px]"
            />
          </div>

          <FileUploadInput
            label="Video URL"
            accept="video"
            value={videoUrl}
            onChange={setVideoUrl}
            folder={`anime/${animeId}/episodes`}
            placeholder="https://example.com/video.mp4"
          />

          <div className="space-y-2">
            <Label htmlFor="externalUrl">External URL (Alternative)</Label>
            <Input
              id="externalUrl"
              type="url"
              placeholder="https://example.com/watch/episode"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="bg-muted/50"
            />
          </div>

          <FileUploadInput
            label="Thumbnail"
            accept="image"
            value={thumbnail}
            onChange={setThumbnail}
            folder={`anime/${animeId}/thumbnails`}
            placeholder="https://example.com/thumbnail.jpg"
          />

          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/upload/anime/${animeId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="anime-button flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
