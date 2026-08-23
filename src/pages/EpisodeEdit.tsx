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
import { ArrowLeft, Save, Film, Volume2, Subtitles, Wand2, Loader2, Upload } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { IntroOutroEditor } from '@/components/upload/IntroOutroEditor';
import { VideoFormatConverter } from '@/components/upload/VideoFormatConverter';
import { SubtitleEditor } from '@/components/upload/SubtitleEditor';
import { extractEmbedSrc } from '@/components/video/PureEmbedPlayer';
import { extractEmbeddedCaptionsToVTT } from '@/lib/extractEmbeddedCaptions';
import { buildEmbedUrl } from '@/lib/embedLink';
import { autoEnsureEmbed } from '@/lib/embedTokens';
import { EmbedManagerPanel } from '@/components/admin/EmbedManagerPanel';

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

    // Validate embed URL when provided; auto-generate a working same-origin embed
    // when a video file exists but no explicit embed link was set so that
    // "Use embed player" always has something to connect to.
    let resolvedExternalUrl: string | null = extractEmbedSrc(externalUrl) || null;
    if (externalUrl.trim() && !resolvedExternalUrl) {
      toast.error('Embed URL is invalid. Paste a valid https:// link or iframe embed code.');
      return;
    }
    if (!resolvedExternalUrl && videoUrl.trim()) {
      resolvedExternalUrl = buildEmbedUrl(episodeId!);
    }

    setIsSaving(true);

    const { error } = await supabase
      .from('episodes')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim() || null,
        external_url: resolvedExternalUrl,
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

  const handleExtractCC = async () => {
    if (!videoUrl) {
      toast.error('Upload or paste a video URL first');
      return;
    }
    if (audioLanguage !== 'original') {
      toast.error('Switch Audio Language to Original (Japanese) to extract CC');
      return;
    }
    setIsExtractingCC(true);
    const loadingId = toast.loading('Analyzing video for embedded captions…');
    try {
      const result = await extractEmbeddedCaptionsToVTT(videoUrl, { preferLang: 'ja' });
      if (!result) {
        toast.error('No extractable captions found in this video file', { id: loadingId });
        return;
      }
      const fileName = `anime/${animeId}/subtitles/ep_${episodeId}_ja.vtt`;
      const blob = new Blob([result.vtt], { type: 'text/vtt' });
      const { error: uploadError } = await supabase.storage
        .from('anime-subtitles')
        .upload(fileName, blob, { upsert: true, contentType: 'text/vtt' });
      if (uploadError) {
        toast.error('Failed to upload extracted captions', { id: loadingId });
        return;
      }
      const { data: urlData } = supabase.storage
        .from('anime-subtitles')
        .getPublicUrl(fileName);
      const { error } = await supabase
        .from('episodes')
        .update({ captions_url: urlData.publicUrl })
        .eq('id', episodeId);
      if (error) {
        toast.error('Failed to attach captions to episode', { id: loadingId });
        return;
      }
      setEpisode(prev => prev ? { ...prev, captions_url: urlData.publicUrl } : null);
      toast.success(`Captions extracted (${result.trackLabel || 'JA'}) and attached`, { id: loadingId });
    } catch (e) {
      console.error('Extract CC failed:', e);
      toast.error('Extraction failed — try a different source or upload a .vtt manually', { id: loadingId });
    } finally {
      setIsExtractingCC(false);
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="externalUrl">External URL (Alternative)</Label>
              {(() => {
                const trimmed = externalUrl.trim();
                const parsed = trimmed ? extractEmbedSrc(trimmed) : null;
                const autoEmbedPrefix = buildEmbedUrl(episodeId!);
                const isAuto = trimmed === autoEmbedPrefix;
                let status: 'valid' | 'auto' | 'needs-fix' | 'empty' = 'empty';
                if (!trimmed) status = videoUrl.trim() ? 'auto' : 'empty';
                else if (isAuto) status = 'auto';
                else if (parsed) status = 'valid';
                else status = 'needs-fix';
                const styles = {
                  valid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                  auto: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                  'needs-fix': 'bg-red-500/15 text-red-400 border-red-500/30',
                  empty: 'bg-muted/40 text-muted-foreground border-border/50',
                }[status];
                const label = {
                  valid: '✓ Valid embed',
                  auto: '⚡ Auto-generated',
                  'needs-fix': '⚠ Needs fix',
                  empty: '— No embed',
                }[status];
                return (
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-md ${styles}`}>
                      {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setExternalUrl(autoEmbedPrefix);
                        toast.success('Embed link regenerated');
                      }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                );
              })()}
            </div>
            <Input
              id="externalUrl"
              type="url"
              placeholder="https://example.com/watch/episode"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Powers the "Use embed player" fallback. Leave blank to auto-generate a working link from the uploaded file.
            </p>
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

          {/* Extract CC from uploaded video — Japanese only */}
          <div className="space-y-2 p-4 rounded-lg border border-border/50 bg-muted/30">
            <Label className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Extract CC from Video File
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically pulls embedded subtitle tracks from the uploaded video.
              Only enabled when Audio Language is set to <strong>Original (Japanese)</strong>.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleExtractCC}
              disabled={isExtractingCC || !videoUrl || audioLanguage !== 'original'}
              className="w-full sm:w-auto"
            >
              {isExtractingCC ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Extracting…</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" /> Extract CC</>
              )}
            </Button>
            {audioLanguage !== 'original' && (
              <p className="text-xs text-amber-400">
                Switch audio to Original (Japanese) to enable CC extraction.
              </p>
            )}
          </div>

          {/* Quick Import .vtt/.srt — uploads the file to storage and attaches it as CC */}
          <div className="space-y-2 p-4 rounded-lg border border-border/50 bg-muted/30">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Import .vtt / .srt Subtitles
            </Label>
            <p className="text-xs text-muted-foreground">
              Upload a WebVTT (.vtt) or SubRip (.srt) file. SRT is auto-converted to VTT.
            </p>
            <input
              id="subtitle-file-import"
              type="file"
              accept=".vtt,.srt,text/vtt,application/x-subrip"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (ext !== 'vtt' && ext !== 'srt') {
                  toast.error('Please choose a .vtt or .srt file');
                  return;
                }
                if (file.size > 20 * 1024 * 1024) {
                  toast.error('Subtitle file too large (max 20MB)');
                  return;
                }
                const loadingId = toast.loading('Uploading subtitles…');
                try {
                  let text = await file.text();
                  // Convert SRT → VTT (comma → dot in timecodes + WEBVTT header)
                  if (ext === 'srt') {
                    text = 'WEBVTT\n\n' + text.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2');
                  } else if (!text.trim().startsWith('WEBVTT')) {
                    text = 'WEBVTT\n\n' + text;
                  }
                  const blob = new Blob([text], { type: 'text/vtt' });
                  const fileName = `anime/${animeId}/subtitles/ep_${episodeId}_import.vtt`;
                  const { error: upErr } = await supabase.storage
                    .from('anime-subtitles')
                    .upload(fileName, blob, { upsert: true, contentType: 'text/vtt', cacheControl: '3600' });
                  if (upErr) {
                    toast.error('Upload failed', { id: loadingId, description: upErr.message });
                    return;
                  }
                  const { data: urlData } = supabase.storage
                    .from('anime-subtitles')
                    .getPublicUrl(fileName);
                  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;
                  const { error: updErr } = await supabase
                    .from('episodes')
                    .update({ captions_url: publicUrl })
                    .eq('id', episodeId);
                  if (updErr) {
                    toast.error('Failed to attach subtitles', { id: loadingId, description: updErr.message });
                    return;
                  }
                  setEpisode(prev => prev ? { ...prev, captions_url: publicUrl } : null);
                  toast.success(`Imported "${file.name}"`, { id: loadingId });
                } catch (err: any) {
                  toast.error('Import failed', { id: loadingId, description: err?.message });
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('subtitle-file-import')?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose .vtt / .srt file
            </Button>
          </div>

          {/* CC Subtitle Editor */}
          <SubtitleEditor
            compact={true}
            onSave={async (vttContent) => {
              try {
                // Ensure user session is attached
                const { data: sessionData } = await supabase.auth.getSession();
                const uid = sessionData.session?.user?.id;
                if (!uid) {
                  toast.error('Please sign in to upload subtitles');
                  return;
                }

                // Normalize + validate size (max 20MB)
                const normalized = vttContent.trim().startsWith('WEBVTT')
                  ? vttContent
                  : `WEBVTT\n\n${vttContent}`;
                const blob = new Blob([normalized], { type: 'text/vtt' });
                if (blob.size > 20 * 1024 * 1024) {
                  toast.error('Subtitle file too large (max 20MB)');
                  return;
                }

                const bucket = 'anime-subtitles';
                const fileName = `anime/${animeId}/subtitles/ep_${episodeId}.vtt`;
                console.log('[Subtitles] Uploading', { uid, bucket, fileName, size: blob.size });

                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from(bucket)
                  .upload(fileName, blob, {
                    upsert: true,
                    contentType: 'text/vtt',
                    cacheControl: '3600',
                  });

                if (uploadError) {
                  console.error('[Subtitles] Storage upload failed', {
                    error: uploadError,
                    message: uploadError.message,
                    uid,
                    bucket,
                    fileName,
                  });
                  const hint = /row-level security/i.test(uploadError.message)
                    ? ' — your account may not have upload permission. Ask an admin to grant the uploader role.'
                    : '';
                  toast.error('Failed to upload subtitles', {
                    description: `${uploadError.message}${hint}`,
                  });
                  return;
                }
                console.log('[Subtitles] Storage upload OK', uploadData);

                const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
                const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

                const { data: updateData, error } = await supabase
                  .from('episodes')
                  .update({ captions_url: publicUrl })
                  .eq('id', episodeId)
                  .select()
                  .maybeSingle();

                if (error) {
                  console.error('[Subtitles] Episode update failed', { error, episodeId });
                  toast.error('Failed to save subtitle URL', { description: error.message });
                  return;
                }
                console.log('[Subtitles] Episode updated', updateData);
                setEpisode(prev => prev ? { ...prev, captions_url: publicUrl } : null);
                toast.success('Subtitles saved');
              } catch (e: any) {
                console.error('[Subtitles] Unexpected save failure', e);
                toast.error('Could not save subtitles', { description: e?.message });
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
