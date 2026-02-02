import { useState, useEffect, forwardRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Loader2, GripVertical } from 'lucide-react';
import { FileUploadInput } from '@/components/upload/FileUploadInput';
import { VideoFormatConverter } from '@/components/upload/VideoFormatConverter';
import { supabase } from '@/integrations/supabase/client';

interface BatchEpisode {
  id: string;
  title: string;
  videoUrl: string;
  thumbnail: string;
  duration: string;
  externalUrl: string;
}

interface BatchEpisodeUploadProps {
  animeId: string;
  seasonId: string;
  currentEpisodeCount: number;
  onEpisodesAdded: () => void;
}

// Storage key for persisting batch upload state
const getStorageKey = (animeId: string, seasonId: string) => 
  `batch_upload_${animeId}_${seasonId}`;

const createEmptyEpisode = (): BatchEpisode => ({
  id: crypto.randomUUID(),
  title: '',
  videoUrl: '',
  thumbnail: '',
  duration: '',
  externalUrl: ''
});

export const BatchEpisodeUpload = forwardRef<HTMLDivElement, BatchEpisodeUploadProps>(
  function BatchEpisodeUpload({ animeId, seasonId, currentEpisodeCount, onEpisodesAdded }, ref) {
  const storageKey = getStorageKey(animeId, seasonId);
  
  // Load initial state from sessionStorage
  const [episodes, setEpisodes] = useState<BatchEpisode[]>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved batch episodes:', e);
    }
    return [createEmptyEpisode()];
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [targetFormat, setTargetFormat] = useState<'original' | 'mp4'>('original');

  // Persist episodes to sessionStorage whenever they change
  useEffect(() => {
    try {
      // Only save if there's meaningful data
      const hasData = episodes.some(ep => ep.title.trim() || ep.videoUrl || ep.externalUrl || ep.thumbnail);
      if (hasData) {
        sessionStorage.setItem(storageKey, JSON.stringify(episodes));
      } else {
        // Clear storage if all episodes are empty
        sessionStorage.removeItem(storageKey);
      }
    } catch (e) {
      console.warn('Failed to save batch episodes:', e);
    }
  }, [episodes, storageKey]);

  const addEpisodeSlot = useCallback(() => {
    setEpisodes(prev => [
      ...prev,
      createEmptyEpisode()
    ]);
  }, []);

  const removeEpisodeSlot = useCallback((id: string) => {
    setEpisodes(prev => {
      if (prev.length === 1) {
        toast.error('At least one episode slot is required');
        return prev;
      }
      return prev.filter(ep => ep.id !== id);
    });
  }, []);

  const updateEpisode = useCallback((id: string, field: keyof BatchEpisode, value: string) => {
    setEpisodes(prev => prev.map(ep => 
      ep.id === id ? { ...ep, [field]: value } : ep
    ));
  }, []);

  const handleBatchUpload = async () => {
    // Filter out empty episodes
    const validEpisodes = episodes.filter(ep => ep.title.trim() && (ep.videoUrl || ep.externalUrl));
    
    if (validEpisodes.length === 0) {
      toast.error('Please add at least one episode with a title and video');
      return;
    }

    setIsUploading(true);

    try {
      const episodesToInsert = validEpisodes.map((ep, index) => ({
        season_id: seasonId,
        episode_number: currentEpisodeCount + index + 1,
        title: ep.title.trim(),
        video_url: ep.videoUrl.trim() || null,
        external_url: ep.externalUrl.trim() || null,
        thumbnail: ep.thumbnail.trim() || null,
        duration: ep.duration ? parseInt(ep.duration) : null,
      }));

      const { error } = await supabase
        .from('episodes')
        .insert(episodesToInsert);

      if (error) {
        console.error('Batch upload error:', error);
        toast.error('Failed to upload episodes');
        return;
      }

      toast.success(`${validEpisodes.length} episode(s) added successfully!`);
      
      // Clear sessionStorage after successful upload
      sessionStorage.removeItem(storageKey);
      
      // Reset form
      setEpisodes([createEmptyEpisode()]);
      
      onEpisodesAdded();
    } catch (error) {
      console.error('Batch upload error:', error);
      toast.error('An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = episodes.filter(ep => ep.title.trim() && (ep.videoUrl || ep.externalUrl)).length;

  return (
    <Card ref={ref} className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Batch Upload Episodes
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add multiple episodes at once. Episodes will be numbered starting from {currentEpisodeCount + 1}.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Converter Option */}
        <VideoFormatConverter
          onFormatChange={setTargetFormat}
          currentFormat={targetFormat}
          showAsCard={false}
          compact={true}
        />
        
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {episodes.map((episode, index) => (
            <div 
              key={episode.id} 
              className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    Episode {currentEpisodeCount + index + 1}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeEpisodeSlot(episode.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Episode title"
                    value={episode.title}
                    onChange={(e) => updateEpisode(episode.id, 'title', e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    placeholder="24"
                    value={episode.duration}
                    onChange={(e) => updateEpisode(episode.id, 'duration', e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <FileUploadInput
                label="Video File"
                accept="video"
                value={episode.videoUrl}
                onChange={(value) => updateEpisode(episode.id, 'videoUrl', value)}
                folder={`anime/${animeId}/episodes`}
                placeholder="Upload or paste video URL"
              />

              <div className="space-y-2">
                <Label>External Link (Alternative)</Label>
                <Input
                  type="url"
                  placeholder="https://example.com/watch/episode"
                  value={episode.externalUrl}
                  onChange={(e) => updateEpisode(episode.id, 'externalUrl', e.target.value)}
                  className="bg-background"
                />
              </div>

              <FileUploadInput
                label="Thumbnail"
                accept="image"
                value={episode.thumbnail}
                onChange={(value) => updateEpisode(episode.id, 'thumbnail', value)}
                folder={`anime/${animeId}/thumbnails`}
                placeholder="Upload or paste thumbnail URL"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={addEpisodeSlot}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Episode
          </Button>
          <Button
            onClick={handleBatchUpload}
            disabled={isUploading || validCount === 0}
            className="anime-button flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {validCount} Episode{validCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
