import { describe, it, expect } from 'vitest';
import { chooseResumeArtwork, resumeArtworkCandidates } from './resumeArtwork';

describe('resume artwork choice', () => {
  it('skips a portrait episode thumbnail in favour of a 16:9 banner', () => {
    expect(chooseResumeArtwork([0.67, 1.78, 0.7])).toBe(1);
  });
  it('keeps a 16:9 episode thumbnail first', () => {
    expect(chooseResumeArtwork([1.78, 1.78])).toBe(0);
  });
  it('falls back to the widest image when none are widescreen', () => {
    expect(chooseResumeArtwork([0.67, null, 1.0])).toBe(2);
  });
  it('dedupes and drops empty sources', () => {
    expect(resumeArtworkCandidates('a', null, 'a', '', 'b')).toEqual(['a', 'b']);
  });
});

import { optimizedImageUrl } from './imageOptimization';
describe('image resizing keeps the original shape', () => {
  it('width-only resizes use contain so 16:9 art is not cropped', () => {
    const url = optimizedImageUrl('https://x.supabase.co/storage/v1/object/public/a/b.jpg', { width: 640 });
    expect(new URL(url).searchParams.get('resize')).toBe('contain');
  });
});
