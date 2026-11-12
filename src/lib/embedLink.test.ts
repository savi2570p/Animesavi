import { describe, expect, it } from 'vitest';
import { buildEmbedUrl, shortEmbedCode } from './embedLink';

describe('copied embed links', () => {
  const id = '6f3a1b2c-9d8e-4f00-a1b2-c3d4e5f60718';

  it('uses the 6-character episode code instead of the anime/season/episode path', () => {
    expect(buildEmbedUrl(id, 'https://animesavi.com')).toBe('https://animesavi.com/embed/6f3a1b');
  });

  it('derives the same code the database stores for the episode', () => {
    expect(shortEmbedCode(id)).toBe('6f3a1b');
  });
});
