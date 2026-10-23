import { expect, it } from 'vitest';
import {
  APP_VERSION,
  DOWNLOAD_SIZE_MB,
  RELEASE_DATE,
  VERSION_GROUPS,
} from './releaseNotes';

it('shows the S2-V2.1 release with a 15MB update size', () => {
  expect(APP_VERSION).toBe('S2-V2.1');
  expect(DOWNLOAD_SIZE_MB).toBe(15);
  expect(RELEASE_DATE).toBe('October 23, 2026');
});

it('leads the popup with performance, stability and bug-fix news', () => {
  const [latest] = VERSION_GROUPS;
  expect(latest.version).toBe(APP_VERSION);
  expect(latest.highlight.toLowerCase()).toContain('performance');
  expect(latest.highlight.toLowerCase()).toContain('stability');

  const titles = latest.items.map((item) => item.title.toLowerCase());
  expect(titles.some((title) => title.includes('stability'))).toBe(true);
  expect(titles.some((title) => title.includes('bug fixes'))).toBe(true);
  expect(latest.items.some((item) => item.badge === 'FIX')).toBe(true);
});

it('keeps the previous release listed under its own version', () => {
  const previous = VERSION_GROUPS[1];
  expect(previous.version).toBe('S2-V2');
  expect(previous.version).not.toBe(APP_VERSION);
});
