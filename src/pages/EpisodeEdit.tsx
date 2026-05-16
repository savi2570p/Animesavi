import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Film, Volume2, Subtitles, Wand2, Loader2 } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { IntroOutroEditor } from '@/components/upload/IntroOutroEditor';
import { VideoFormatConverter } from '@/components/upload/VideoFormatConverter';
import { SubtitleEditor } from '@/components/upload/SubtitleEditor';
import { extractEmbedSrc } from '@/components/video/PureEmbedPlayer';
import { extractEmbeddedCaptionsToVTT } from '@/lib/extractEmbeddedCaptions';

const AUDIO_LANGUAGES = [
  { value: 'original', label: 'Original (Japanese)' },
  { value: 'Hindi', label: 'Hindi DUB' },
  { value: 'English', label: 'English DUB' },
  { value: 'Tamil', label: 'Tamil DUB' },
  { value: 'Telugu', label: 'Telugu DUB' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Chinese', label: 'Chinese (Mandarin)' },
  { value: 'Cantonese', label: 'Chinese (Cantonese)' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Indonesian', label: 'Indonesian' },
];

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
  audio_language: string | null;
  captions_url: string | null;
  intro_start_time: number | null;
  intro_end_time: number | null;
  outro_start_time: number | null;
  outro_end_time: number | null;
}

interface Anime {
  id: string;
  title: string;
  uploader_id: string | null;
  is_muse: boolean;
}

export default function EpisodeEdit() {
  const { animeId, episodeId } = useParams<{ animeId: string; episodeId: string }>();
  const { user, isAdmin, isUploader, isRolesLoaded, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [anime, setAnime] = useState<Anime | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMuse, setIsMuse] = useState(false);
  const [isSavingMuse, setIsSavingMuse] = useState(false);
  const [isExtractingCC, setIsExtractingCC] = useState(false);

  const isAuthReady = !isAuthLoading && isRolesLoaded;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [duration, setDuration] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('original');
  const [introStartTime, setIntroStartTime] = useState<number | null>(null);
  const [introEndTime, setIntroEndTime] = useState<number | null>(null);
  const [outroStartTime, setOutroStartTime] = useState<number | null>(null);
  const [outroEndTime, setOutroEndTime] = useState<number | null>(null);

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
      .select('id, title, uploader_id, is_muse')
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

    setAnime(animeData as Anime);
    setIsMuse((animeData as any).is_muse || false);

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
    setAudioLanguage(episodeData.audio_language || 'original');
    setIntroStartTime(episodeData.intro_start_time);
    setIntroEndTime(episodeData.intro_end_time);
    setOutroStartTime(episodeData.outro_start_time);
    setOutroEndTime(episodeData.outro_end_time);

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
        external_url: extractEmbedSrc(externalUrl) || null,
        thumbnail: thumbnail.trim() || null,
        duration: duration ? parseInt(duration) : null,
        episode_number: parseInt(episodeNumber),
        audio_language: audioLanguage || 'original',
        intro_start_time: introStartTime,
        intro_end_time: introEndTime,
        outro_start_time: outroStartTime,
        outro_end_time: outroEndTime,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Audio Language Selection - Important for DUB */}
          <div className="space-y-2">
            <Label htmlFor="audioLanguage" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              Audio Language / DUB *
            </Label>
            <Select value={audioLanguage} onValueChange={setAudioLanguage}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue placeholder="Select audio language" />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Important: Select the actual audio language of the video file you're uploading
            </p>
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

          {/* Video Format Converter */}
          <VideoFormatConverter
            showAsCard={false}
            compact={true}
          />

          {/* Uploaded CC Preview & Delete */}
          {episode?.captions_url && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Subtitles className="h-4 w-4 text-primary" />
                Current Subtitles (CC)
              </Label>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                <a 
                  href={episode.captions_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate flex-1"
                >
                  {episode.captions_url.split('/').pop() || 'subtitles.vtt'}
                </a>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('episodes')
                      .update({ captions_url: null })
                      .eq('id', episodeId);
                    if (error) {
                      toast.error('Failed to remove subtitles');
                    } else {
                      setEpisode(prev => prev ? { ...prev, captions_url: null } : null);
                      toast.success('Subtitles removed');
                    }
                  }}
                >
                  Delete CC
                </Button>
              </div>
            </div>
          )}

          {/* CC Subtitle Editor */}
          <SubtitleEditor
            compact={true}
            onSave={async (vttContent) => {
              // Upload VTT to storage
              const fileName = `anime/${animeId}/subtitles/ep_${episodeId}.vtt`;
              const blob = new Blob([vttContent], { type: 'text/vtt' });
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('anime-subtitles')
                .upload(fileName, blob, { upsert: true });
              
              if (uploadError) {
                toast.error('Failed to upload subtitles');
                return;
              }
              
              const { data: urlData } = supabase.storage
                .from('anime-subtitles')
                .getPublicUrl(fileName);
              
              // Save URL to episode
              const { error } = await supabase
                .from('episodes')
                .update({ captions_url: urlData.publicUrl })
                .eq('id', episodeId);
              
              if (error) {
                toast.error('Failed to save subtitle URL');
              } else {
                setEpisode(prev => prev ? { ...prev, captions_url: urlData.publicUrl } : null);
                toast.success('Subtitles saved successfully!');
              }
            }}
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

      {/* Add to MUSE Toggle */}
      <div className="mt-6 flex items-center gap-4 p-4 bg-card/50 rounded-xl border border-border/50">
        <label htmlFor="ep_is_muse" className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            id="ep_is_muse"
            checked={isMuse}
            onChange={async (e) => {
              const val = e.target.checked;
              setIsMuse(val);
              setIsSavingMuse(true);
              const { error } = await supabase
                .from('anime')
                .update({ is_muse: val } as any)
                .eq('id', animeId);
              if (error) {
                toast.error('Failed to update MUSE status');
                setIsMuse(!val);
              } else {
                toast.success(val ? 'Added to MUSE tab' : 'Removed from MUSE tab');
              }
              setIsSavingMuse(false);
            }}
            className="w-5 h-5 rounded border-border accent-primary"
          />
          <span className="text-sm font-medium">Add to MUSE Tab</span>
        </label>
        {isSavingMuse && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
        )}
      </div>

      {/* Intro/Outro Editor */}
      <div className="mt-8">
        <IntroOutroEditor
          videoUrl={videoUrl || externalUrl}
          introStartTime={introStartTime}
          introEndTime={introEndTime}
          outroStartTime={outroStartTime}
          outroEndTime={outroEndTime}
          onSave={(data) => {
            setIntroStartTime(data.introStartTime);
            setIntroEndTime(data.introEndTime);
            setOutroStartTime(data.outroStartTime);
            setOutroEndTime(data.outroEndTime);
            toast.success('Timestamps updated! Click "Save Changes" to save.');
          }}
        />
      </div>
    </div>
  );
}
