import { describe, expect, it } from 'vitest';
import { PLAYER_REPORT_OPTIONS } from './ReportButton';

describe('player report options', () => {
  it('offers exactly the five reasons the owner chose, in order', () => {
    expect(PLAYER_REPORT_OPTIONS.map(o => o.value)).toEqual([
      'Wrong Episode',
      'Video Not Working',
      'Audio Issue',
      'Subtitle Issue',
      'Something else',
    ]);
  });
});
