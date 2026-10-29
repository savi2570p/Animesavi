import { it, expect } from 'vitest';
import { select1080Variant } from './hlsDataSaver';
it('selects the 1080p native Safari playlist rather than 4K', () => {
  expect(select1080Variant('#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=3840x2160\n4k.m3u8\n#EXT-X-STREAM-INF:RESOLUTION=1920x1080\nhd.m3u8', 'https://example.test/master.m3u8')).toBe('https://example.test/hd.m3u8');
});
it('does not claim a 4K-only playlist has a Data Saver rendition', () => {
  expect(select1080Variant('#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=3840x2160\n4k.m3u8', 'https://example.test/master.m3u8')).toBeNull();
});