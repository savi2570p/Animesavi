import { expect, it } from 'vitest';
import {
  APP_VERSION,
  DOWNLOAD_SIZE_MB,
  RELEASE_DATE,
  VERSION_GROUPS,
} from './releaseNotes';

it('uses the S2-V3.1 release version', () => {
  expect(APP_VERSION).toBe('S2-V3.1');
});

it('uses the requested 12MB update size', () => {
  expect(DOWNLOAD_SIZE_MB).toBe(12);
});

it('dates the current release November 28, 2026', () => {
  expect(RELEASE_DATE).toBe('November 28, 2026');
});

it('keeps the previous release listed under its own version', () => {
  const previous = VERSION_GROUPS[1];
  expect(previous.version).toBe('S2-V3+');
  expect(previous.version).not.toBe(APP_VERSION);
});
