import { memo, useEffect, useMemo, useState } from 'react';
import { optimizedImageUrl } from '@/lib/imageOptimization';
import { chooseResumeArtwork, resumeArtworkCandidates, WIDESCREEN_MIN_RATIO } from '@/lib/resumeArtwork';

const chosenCache = new Map<string, string>();

function measure(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface ResumeArtworkProps {
  sources: Array<string | null | undefined>;
  alt: string;
  width?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/** Full 16:9 resume artwork: skips portrait posters in favour of widescreen art, never crops. */
export const ResumeArtwork = memo(function ResumeArtwork({ sources, alt, width = 640, className = '', loading = 'lazy' }: ResumeArtworkProps) {
  const candidates = useMemo(() => resumeArtworkCandidates(...sources), [sources.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = candidates.join('|');
  const [src, setSrc] = useState<string | null>(() => chosenCache.get(key) ?? null);

  useEffect(() => {
    const cached = chosenCache.get(key);
    if (cached) { setSrc(cached); return; }
    let cancelled = false;
    (async () => {
      const urls: string[] = [];
      const ratios: Array<number | null> = [];
      for (const raw of candidates) {
        let url = optimizedImageUrl(raw, { width, quality: 78 });
        let ratio = await measure(url);
        if (ratio === null && url !== raw) { url = raw; ratio = await measure(raw); }
        if (cancelled) return;
        urls.push(url); ratios.push(ratio);
        if (ratio !== null && ratio >= WIDESCREEN_MIN_RATIO) break;
      }
      const index = chooseResumeArtwork(ratios);
      const chosen = index >= 0 ? urls[index] : '/placeholder.svg';
      chosenCache.set(key, chosen);
      setSrc(chosen);
    })();
    return () => { cancelled = true; };
  }, [key, candidates, width]);

  if (!src) return <span aria-hidden className={`absolute inset-0 bg-muted/40 animate-pulse ${className}`} />;
  return <img src={src} alt={alt} loading={loading} decoding="async" draggable={false} className={`absolute inset-0 w-full h-full object-contain ${className}`} />;
});
