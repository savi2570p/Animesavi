import { useEffect, useState } from 'react';
import logo from '@/assets/logo.png';

interface AnimeDetailLoaderProps {
  isReady: boolean;
  backdrop?: string | null;
  title?: string;
}

/**
 * Anime detail loading screen: a faint skeleton of the detail layout with a
 * centred AnimeSavi+ mark and orbiting lime arc. Its lifetime follows the
 * page's real loading state — no fake delays.
 */
export function AnimeDetailLoader({ isReady, backdrop, title }: AnimeDetailLoaderProps) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!isReady) { setHidden(false); return; }
    const timer = setTimeout(() => setHidden(true), 320);
    return () => clearTimeout(timer);
  }, [isReady]);
  if (hidden) return null;

  const heading = title && title !== 'Loading anime details' ? title : null;

  return (
    <div
      className={`dl5 fixed inset-0 z-[80] transition-opacity duration-300 ${isReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      role="status"
      aria-live="polite"
      aria-busy={!isReady}
      aria-label="Loading anime details"
    >
      {backdrop && <img src={backdrop} alt="" className="dl5-art" />}

      {/* Faint skeleton of the detail page so the layout feels like it is assembling */}
      <div className="dl5-skeleton" aria-hidden="true">
        <div className="dl5-banner dl5-shimmer" />
        <div className="dl5-body">
          <div className="dl5-poster dl5-shimmer" />
          <div className="dl5-lines">
            <span className="dl5-shimmer" style={{ width: '58%', height: 22 }} />
            <span className="dl5-shimmer" style={{ width: '34%' }} />
            <div className="dl5-chips">
              <span className="dl5-shimmer" /><span className="dl5-shimmer" /><span className="dl5-shimmer" />
            </div>
            <span className="dl5-shimmer" style={{ width: '92%' }} />
            <span className="dl5-shimmer" style={{ width: '80%' }} />
          </div>
        </div>
      </div>

      <div className="dl5-center">
        <div className="dl5-mark">
          <svg viewBox="0 0 80 80" className="dl5-ring" aria-hidden="true">
            <circle cx="40" cy="40" r="36" className="dl5-ring-track" />
            <circle cx="40" cy="40" r="36" className="dl5-ring-arc" />
          </svg>
          <img src={logo} alt="" className="dl5-logo" />
        </div>
        <p className="dl5-brand">AnimeSavi<span>+</span></p>
        <p className="dl5-title">{heading || 'Opening anime details'}</p>
        <div className="dl5-track" aria-hidden="true"><span /></div>
      </div>
      <span className="sr-only">{isReady ? 'Content loaded' : 'Loading anime details, please wait.'}</span>
    </div>
  );
}
