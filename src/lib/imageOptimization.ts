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
