import { describe, expect, it } from 'vitest';
import { escapeHtml } from './htmlEscape';

describe('escapeHtml', () => {
  it('escapes markup and attribute delimiters from an untrusted media URL', () => {
    const hostile = 'https://media.test/video.mp4\" onclick=\"alert(1)"><script>alert(2)</script>&x=\'1\'';
    expect(escapeHtml(hostile)).toBe('https://media.test/video.mp4&quot; onclick=&quot;alert(1)&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;&amp;x=&#39;1&#39;');
  });

  it('leaves ordinary HTTPS media URLs intact', () => {
    expect(escapeHtml('https://media.test/video.mp4')).toBe('https://media.test/video.mp4');
  });
});
