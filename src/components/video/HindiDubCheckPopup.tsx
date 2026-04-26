import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HindiDubCheckPopupProps {
  audioLanguage: string | null | undefined;
  episodeId: string;
  onContinueJapanese: () => void;
}

// Session memory: episodes where user already chose "Continue in Japanese"
const dismissedEpisodes = new Set<string>();

export function HindiDubCheckPopup({ audioLanguage, episodeId, onContinueJapanese }: HindiDubCheckPopupProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const hasHindi = useCallback(() => {
    if (!audioLanguage) return false;
    const lang = audioLanguage.toLowerCase();
    // Check if Hindi is mentioned in the audio language field
    return (
      lang.includes('hindi') ||
      lang.includes('hin') ||
      lang === 'hi' ||
      lang.includes('multi') ||
      lang.includes('dual') ||
      lang.includes('hindi dub')
    );
  }, [audioLanguage]);

  useEffect(() => {
    // If already dismissed for this episode, skip
    if (dismissedEpisodes.has(episodeId)) {
      setVisible(false);
      return;
    }

    // If audio_language is null/empty, assume it may have Hindi (don't block)
    if (!audioLanguage || audioLanguage.trim() === '') {
      setVisible(false);
      return;
    }

    // If Hindi is NOT available, show popup
    if (!hasHindi()) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [audioLanguage, episodeId, hasHindi]);

  const handleContinueJapanese = () => {
    dismissedEpisodes.add(episodeId);
    setVisible(false);
    onContinueJapanese();
  };

  const handleNoThanks = () => {
    dismissedEpisodes.add(episodeId);
    setVisible(false);
    navigate('/');
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 sm:pb-3">
      <div className="relative w-full max-w-md mx-auto rounded-2xl sm:rounded-2xl border border-red-500/30 bg-gradient-to-b from-zinc-900/95 to-black/95 shadow-2xl shadow-red-900/20 p-6 sm:p-8 text-center space-y-5 animate-in zoom-in-95 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300 max-h-[calc(100vh-2rem)] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleNoThanks}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-3xl">🎧</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white">
          This episode is not available in Hindi DUB
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-zinc-400 leading-relaxed">
          You can continue watching in Japanese with subtitles.
        </p>

        {/* Detected language */}
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
          <span className="px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700">
            Available: {audioLanguage || 'Unknown'}
          </span>
        </div>

        {/* Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleContinueJapanese}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all"
          >
            Continue in Japanese
          </Button>
          <Button
            onClick={handleNoThanks}
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white py-3 rounded-xl transition-all"
          >
            No Thanks
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if an episode has Hindi dub available based on audio_language field
 */
export function hasHindiDub(audioLanguage: string | null | undefined): boolean {
  if (!audioLanguage) return true; // Assume yes if no data
  const lang = audioLanguage.toLowerCase();
  return (
    lang.includes('hindi') ||
    lang.includes('hin') ||
    lang === 'hi' ||
    lang.includes('multi') ||
    lang.includes('dual')
  );
}
