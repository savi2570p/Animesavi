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

export interface DownloadAudioTrack {
  label: string;
  language: string;
}

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

  const hasMultipleAudio = audioTracks.length > 1;

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
    const track = audioTracks[selectedAudio];
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
        className="max-w-[calc(100vw-2rem)] sm:max-w-xs rounded-2xl p-4 sm:p-5 gap-3 border-white/10"
        style={{
          background: 'linear-gradient(160deg, rgba(30, 16, 50, 0.82), rgba(12, 7, 22, 0.9))',
          backdropFilter: 'blur(28px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
          boxShadow: '0 8px 40px hsl(270 80% 40% / 0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="flex items-center gap-1.5 text-sm sm:text-base">
            <Download className="w-4 h-4 text-destructive" />
            Download
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2.5 pt-1">
              <div className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 space-y-0.5">
                {animeTitle && (
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{animeTitle}</p>
                )}
                {episodeLabel && (
                  <p className="text-[11px] sm:text-xs text-muted-foreground">{episodeLabel}</p>
                )}
              </div>

              {/* Audio Language Selection */}
              {hasMultipleAudio && (
                <div className="space-y-1.5">
                  <p className="text-[11px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Audio Language
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {audioTracks.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedAudio(i)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] sm:text-xs font-medium transition-all ${
                          selectedAudio === i
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-white/10 bg-white/5 text-foreground/80 hover:border-primary/40'
                        }`}
                      >
                        {selectedAudio === i && <Check className="w-3 h-3" />}
                        {audioLabel(t, i)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Selection */}
              <div className="space-y-1.5">
                <p className="text-[11px] sm:text-xs font-medium text-foreground">Quality</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => setSelectedQuality(q.label)}
                      className={`relative flex flex-col items-center px-1 py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition-all ${
                        selectedQuality === q.label
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-white/10 bg-white/5 text-foreground/80 hover:border-primary/40'
                      }`}
                    >
                      <span>{q.label}</span>
                      <span className={`text-[8px] font-bold ${selectedQuality === q.label ? 'text-primary' : 'text-muted-foreground'}`}>{q.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
          <AlertDialogCancel className="flex-1 h-8 text-xs border-white/15 bg-white/5 text-foreground/80 hover:bg-white/10 hover:text-foreground mt-0">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={handlePrepare}
            disabled={isPreparing || !selectedQuality}
            className="flex-1 h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
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
