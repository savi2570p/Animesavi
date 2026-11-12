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
    if (!open || audioTracks.length || !videoUrl) {
      setDetectingAudio(false);
      return;
    }
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

    // Save the chosen audio language as the user's preference
    const track = availableTracks[selectedAudio];
    if (track) {
      const code = normalizeLanguageCode(track.language);
      try {
      if (code && code !== 'und') {
        localStorage.setItem('preferred_audio_language', code);
      } else {
        localStorage.setItem('preferred_audio_language', audioLabel(track, selectedAudio));
      }
      } catch { /* Storage can be unavailable in embedded/private browsers. */ }
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

  const qualityHint: Record<string, string> = { '480p': 'Smallest file', '720p': 'Balanced', '1080p': 'Full HD', '2160p': 'Largest file' };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedQuality(null); }}>
      <AlertDialogContent className="dl-v2 max-w-[calc(100vw-1.5rem)] sm:max-w-sm p-0 gap-0">
        <AlertDialogHeader className="dl-v2-head space-y-0 text-left">
          <span className="dl-v2-icon" aria-hidden><Download className="w-4 h-4" /></span>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle className="dl-v2-title">Download</AlertDialogTitle>
            <p className="dl-v2-sub">Choose audio and quality</p>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription asChild>
          <div className="dl-v2-body">
            {(animeTitle || episodeLabel) && (
              <div className="dl-v2-episode">
                {animeTitle && <p className="dl-v2-anime">{animeTitle}</p>}
                {episodeLabel && <p className="dl-v2-ep">{episodeLabel}</p>}
              </div>
            )}

            <section className="dl-v2-section" aria-label="Audio language">
              <p className="dl-v2-label"><Volume2 className="w-3.5 h-3.5" aria-hidden /> Audio language</p>
              {detectingAudio && <p className="dl-v2-note"><Loader2 className="h-3 w-3 animate-spin" />Reading audio tracks…</p>}
              {!detectingAudio && !availableTracks.length && <p className="dl-v2-note">Audio languages unavailable for this source.</p>}
              {availableTracks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableTracks.map((t, i) => (
                    <button
                      type="button"
                      key={i}
                      aria-pressed={selectedAudio === i}
                      onClick={() => setSelectedAudio(i)}
                      className="dl-v2-chip"
                    >
                      {selectedAudio === i && <Check className="w-3 h-3" aria-hidden />}
                      {audioLabel(t, i)}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="dl-v2-section" aria-label="Quality">
              <p className="dl-v2-label">Quality</p>
              <div className="dl-v2-grid">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    type="button"
                    key={q.label}
                    aria-pressed={selectedQuality === q.label}
                    onClick={() => setSelectedQuality(q.label)}
                    className="dl-v2-quality"
                  >
                    <span className="dl-v2-q">{q.label}</span>{' '}
                    <span className="dl-v2-tag">{q.tag}</span>
                    <span className="dl-v2-hint" aria-hidden>{qualityHint[q.label]}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter className="dl-v2-foot flex-row gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel className="dl-v2-cancel mt-0">Cancel</AlertDialogCancel>
          <Button
            onClick={handlePrepare}
            disabled={isPreparing || !selectedQuality}
            className="dl-v2-go gap-1.5"
          >
            {isPreparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isPreparing ? 'Preparing…' : selectedQuality ? `Download ${selectedQuality}` : 'Select quality'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
