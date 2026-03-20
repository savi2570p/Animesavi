import { useState, useCallback } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface YouTubeEmbedProps {
  url: string;
  title?: string;
}

/**
 * Convert any YouTube URL to embed format and extract video ID.
 */
function parseYouTubeUrl(url: string): { embedUrl: string; videoId: string } | null {
  let videoId: string | null = null;

  // youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) videoId = watchMatch[1];

  // youtu.be/ID
  if (!videoId) {
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) videoId = shortMatch[1];
  }

  // youtube.com/embed/ID
  if (!videoId) {
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) videoId = embedMatch[1];
  }

  // youtube.com/shorts/ID
  if (!videoId) {
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) videoId = shortsMatch[1];
  }

  if (!videoId) return null;

  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`,
  };
}

export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

export function YouTubeEmbed({ url, title = 'Video' }: YouTubeEmbedProps) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const parsed = parseYouTubeUrl(url);

  const thumbnailUrl = parsed
    ? `https://img.youtube.com/vi/${parsed.videoId}/maxresdefault.jpg`
    : null;

  const handleIframeError = useCallback(() => {
    setEmbedFailed(true);
  }, []);

  // Could not parse or embed refused — show fallback
  if (!parsed || embedFailed) {
    return (
      <div className="relative w-full bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="relative z-10 flex flex-col items-center gap-4 text-center p-6">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-xl">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <p className="text-white font-semibold text-lg">This video can't be embedded</p>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => window.open(url, '_blank', 'noopener')}
          >
            Watch on YouTube
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={parsed.embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title={title}
        style={{ border: 'none' }}
        onError={handleIframeError}
      />
    </div>
  );
}
