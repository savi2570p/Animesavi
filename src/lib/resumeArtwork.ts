/**
 * Resume cards are 16:9. Some uploads store a portrait poster as the episode
 * thumbnail, which `object-contain` shows with side bars. Pick the first
 * candidate whose natural shape is widescreen; fall back to the widest seen.
 */
export const WIDESCREEN_MIN_RATIO = 1.45;

export function resumeArtworkCandidates(...urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url?.trim();
    if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); out.push(trimmed); }
  }
  return out.length ? out : ['/placeholder.svg'];
}

export function isWidescreen(width: number, height: number): boolean {
  return width > 0 && height > 0 && width / height >= WIDESCREEN_MIN_RATIO;
}

/** Given measured ratios (null = failed/unmeasured), return the index to display. */
export function chooseResumeArtwork(ratios: Array<number | null>): number {
  const firstWide = ratios.findIndex((r) => r !== null && r >= WIDESCREEN_MIN_RATIO);
  if (firstWide >= 0) return firstWide;
  let best = -1;
  ratios.forEach((r, i) => { if (r !== null && (best < 0 || r > (ratios[best] as number))) best = i; });
  return best;
}
