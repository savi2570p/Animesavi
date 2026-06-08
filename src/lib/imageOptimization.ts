/**
 * Image optimization utilities for faster CDN content delivery.
 * 
 * - Preloads critical above-fold images
 * - Uses Intersection Observer for smart lazy loading
 * - Adds fetchpriority hints
 */

const preloadedUrls = new Set<string>();
const memoryImageCache = new Map<string, HTMLImageElement>();

/** Preload a single image URL into browser cache */
export function preloadImage(url: string): void {
  if (!url || preloadedUrls.has(url)) return;
  preloadedUrls.add(url);

  if (!memoryImageCache.has(url)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    memoryImageCache.set(url, img);
  }
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('fetchpriority', 'high');
  document.head.appendChild(link);
}

/** Preload multiple images in parallel */
export function preloadImages(urls: (string | null | undefined)[]): void {
  urls.forEach(url => {
    if (url) preloadImage(url);
  });
}

/** Preload first N images from a list (for carousels, grids) */
export function preloadFirstN(
  items: { image?: string | null; cover_image?: string | null; thumbnail?: string | null }[],
  count: number = 4
): void {
  const urls = items.slice(0, count).map(item => 
    item.image || item.cover_image || item.thumbnail
  );
  preloadImages(urls);
}

/**
 * Add Supabase storage transform params for optimized thumbnails.
 * Uses Supabase Image Transformation for smaller file sizes.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  if (!url) return '/placeholder.svg';
  
  // Only transform Supabase storage URLs
  if (!url.includes('supabase.co/storage')) return url;
  
  const { width, height, quality = 75 } = options;
  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  
  // Supabase render endpoint
  const renderUrl = url.replace('/object/public/', '/render/image/public/');
  return `${renderUrl}?${params.toString()}`;
}

/**
 * Return a FHD (1920w / 1080w) render URL when the asset lives on Supabase
 * Storage. Use together with `onError={fhdFallback}` so the browser swaps to
 * the original (un-resized) URL if the render endpoint fails or the source is
 * smaller than 1080p.
 */
export function fhdImageUrl(
  url: string | null | undefined,
  variant: 'poster' | 'banner' = 'banner',
): string {
  if (!url) return '/placeholder.svg';
  if (!url.includes('supabase.co/storage')) return url;
  const width = variant === 'banner' ? 1920 : 1080;
  return optimizedImageUrl(url, { width, quality: 90 });
}

/**
 * onError handler that swaps a FHD render URL back to the raw Supabase object
 * URL. Attach via `<img onError={fhdFallback(originalUrl)} />`.
 */
export function fhdFallback(originalUrl: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!originalUrl) return;
    const el = e.currentTarget;
    if (el.dataset.fhdFallbackApplied === '1') return;
    el.dataset.fhdFallbackApplied = '1';
    el.src = originalUrl;
  };
}
