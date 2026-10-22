import { describe, it, expect, beforeEach } from 'vitest';
import { readEmbedResume, saveEmbedResume } from './embedResume';
import { safeStorage } from './storage/safeStorage';

describe('copied embed resume', () => {
  beforeEach(() => { safeStorage.removeItem('resume:ep1'); safeStorage.removeItem('resume:ep2'); });
  it('restores the position where the same episode was left', () => {
    saveEmbedResume('ep1', 123, 1200);
    expect(readEmbedResume('ep1', 1200)).toBe(123);
    expect(readEmbedResume('ep2', 1200)).toBe(0);
  });
  it('uses an explicit timestamp instead of the saved position', () => {
    saveEmbedResume('ep1', 123, 1200);
    expect(readEmbedResume('ep1', 1200, 45)).toBe(45);
  });
  it('clears completed playback so rewatch starts at the beginning', () => {
    saveEmbedResume('ep1', 1200, 1200, true);
    expect(readEmbedResume('ep1', 1200)).toBe(0);
  });
});