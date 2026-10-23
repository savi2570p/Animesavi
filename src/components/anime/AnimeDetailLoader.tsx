import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!isReady) { setHidden(false); return; }
    const timer = setTimeout(() => setHidden(true), 420);
    return () => clearTimeout(timer);
  }, [isReady]);
  if (hidden) return null;
  return (
    <div className={`detail-loading-v4 fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-300 ${isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} role="status" aria-live="polite" aria-busy={!isReady} aria-label="Loading anime details">
      {backdrop && <img src={backdrop} alt="" className="detail-loading-v4-art" />}
      <div className="detail-loading-v4-panel relative w-full max-w-xs rounded-lg p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6"><Film className="h-6 w-6 text-primary" /><span className="text-sm font-semibold">Anime Savi</span></div>
        <p className="text-xs text-muted-foreground mb-2">Opening title</p>
        <h2 className="text-lg font-semibold leading-snug break-words">{title && title !== 'Loading anime details' ? title : 'Anime details'}</h2>
        <div className="detail-loading-v4-track rounded mt-6" aria-hidden="true"><span /></div>
        <span className="sr-only">{isReady ? 'Content loaded' : 'Loading anime details, please wait.'}</span>
      </div>
    </div>
  );
}
