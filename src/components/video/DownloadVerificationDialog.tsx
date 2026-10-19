import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Download, Loader2, Check, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAudioTrackLabel, normalizeLanguageCode } from '@/lib/audioLanguageUtils';

import { discoverDownloadAudio, type DownloadAudioTrack } from '@/lib/downloadAudio';
export type { DownloadAudioTrack } from '@/lib/downloadAudio';

interface DownloadVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  fileName: string;
  animeTitle?: string;
  episodeLabel?: string;
  audioTracks?: DownloadAudioTrack[];
  currentAudioTrack?: number;
}

const QUALITY_OPTIONS = [
  { label: '480p', tag: 'SD' },
  { label: '720p', tag: 'HD' },
  { label: '1080p', tag: 'FHD' },
  { label: '2160p', tag: '4K' },
];

export function DownloadVerificationDialog({
  open,
  onOpenChange,
  videoUrl,
  fileName,
  animeTitle,
  episodeLabel,
  audioTracks = [],
  currentAudioTrack = 0,
}: DownloadVerificationDialogProps) {
  const navigate = useNavigate();
  const [isPreparing, setIsPreparing] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<number>(currentAudioTrack);

  // Reset selection to the track currently playing whenever the dialog opens
  useEffect(() => {
    if (open) setSelectedAudio(currentAudioTrack);
  }, [open, currentAudioTrack]);

  const [discoveredTracks, setDiscoveredTracks] = useState<DownloadAudioTrack[]>([]);
  const [detectingAudio, setDetectingAudio] = useState(false);
  const availableTracks = audioTracks.length ? audioTracks : discoveredTracks;

  useEffect(() => {
    if (!open || audioTracks.length || !videoUrl) return;
    const controller = new AbortController();
    setDiscoveredTracks([]);
    setDetectingAudio(true);
    discoverDownloadAudio(videoUrl, controller.signal)
      .then((tracks) => { if (!controller.signal.aborted) setDiscoveredTracks(tracks); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setDetectingAudio(false); });
    return () => controller.abort();
  }, [open, videoUrl, audioTracks.length]);

  const audioLabel = (t: DownloadAudioTrack, i: number) =>
    getAudioTrackLabel(t.label, t.language, i, animeTitle);

  const handlePrepare = () => {
    if (!videoUrl) {
      toast.error('No video available for download');
      return;
    }
    if (!selectedQuality) {
      toast.error('Please select a quality');
      return;
    }

    setIsPreparing(true);

    // Save the chosen audio language as the user's preference
    const track = availableTracks[selectedAudio];
    if (track) {
      const code = normalizeLanguageCode(track.language);
      if (code && code !== 'und') {
        localStorage.setItem('preferred_audio_language', code);
      } else {
        localStorage.setItem('preferred_audio_language', audioLabel(track, selectedAudio));
      }
    }

    // Parse episode number from label, e.g. "Season 1 - Episode 5" → "05"
    let epNum = '01';
    if (episodeLabel) {
      const m = episodeLabel.match(/Episode\s*(\d+)/i);
      if (m) epNum = m[1].padStart(2, '0');
      else if (/movie/i.test(episodeLabel)) epNum = 'Movie';
    }

    const params = new URLSearchParams({
      quality: selectedQuality,
      anime: animeTitle || 'AnimeSavi',
      ep: epNum,
      url: videoUrl,
    });
    if (track) {
      params.set('audio', String(selectedAudio));
      params.set('audioLang', normalizeLanguageCode(track.language) || track.language || '');
    }

    onOpenChange(false);
    setSelectedQuality(null);
    setIsPreparing(false);
    navigate(`/Shadow-Arise?${params.toString()}`);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedQuality(null); }}>
      <AlertDialogContent
        className="download-glass max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-xl p-3 sm:p-4 gap-3"
      >
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="flex items-center gap-1.5 text-sm sm:text-base">
            <Download className="w-4 h-4 text-foreground" />
            Download
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2.5 pt-1">
              <div className="rounded-lg bg-muted/40 border border-border/60 px-2.5 py-2 space-y-0.5">
                {animeTitle && (
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{animeTitle}</p>
                )}
                {episodeLabel && (
                  <p className="text-[11px] sm:text-xs text-muted-foreground">{episodeLabel}</p>
                )}
              </div>

              {/* Audio Language Selection */}
              {(
                <div className="space-y-1.5">
                  <p className="text-[11px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Audio Language
                  </p>
                  {detectingAudio && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Reading audio tracks…</p>}
                  {!detectingAudio && !availableTracks.length && <p className="text-xs text-muted-foreground">Audio languages unavailable for this source.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {availableTracks.map((t, i) => (
                      <Button type="button" variant="outline"
                        key={i}
                        onClick={() => setSelectedAudio(i)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 h-auto rounded-md border text-[11px] sm:text-xs font-medium transition-all ${
                          selectedAudio === i
                            ? 'download-choice-selected'
                            : 'border-border/60 bg-muted/30 text-foreground/80 hover:bg-accent'
                        }`}
                      >
                        {selectedAudio === i && <Check className="w-3 h-3" />}
                        {audioLabel(t, i)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Selection */}
              <div className="space-y-1.5">
                <p className="text-[11px] sm:text-xs font-medium text-foreground">Quality</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUALITY_OPTIONS.map((q) => (
                    <Button type="button" variant="outline"
                      key={q.label}
                      onClick={() => setSelectedQuality(q.label)}
                      className={`h-auto relative flex flex-col items-center px-1 py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition-all ${
                        selectedQuality === q.label
                          ? 'download-choice-selected'
                          : 'border-border/60 bg-muted/30 text-foreground/80 hover:bg-accent'
                      }`}
                    >
                      <span>{q.label}</span>
                      <span className={`text-[8px] font-bold ${selectedQuality === q.label ? 'text-foreground' : 'text-muted-foreground'}`}>{q.tag}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 h-8 text-xs border-border/60 bg-muted/30 text-foreground/80 hover:bg-accent hover:text-foreground mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handlePrepare}
            disabled={isPreparing || !selectedQuality || detectingAudio}
            className="flex-1 h-8 text-xs download-confirm-action gap-1.5"
          >
            {isPreparing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isPreparing ? 'Preparing…' : selectedQuality ? `Download ${selectedQuality}` : 'Select Quality'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
