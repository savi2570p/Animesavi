import { expect, it } from 'vitest';
import { DOWNLOAD_SIZE_MB } from './releaseNotes';

it('displays the requested 12MB update size', () => {
  expect(DOWNLOAD_SIZE_MB).toBe(12);
});