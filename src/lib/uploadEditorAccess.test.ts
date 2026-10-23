import { describe, expect, it } from 'vitest';
import { canEnterUploadEditor } from './uploadEditorAccess';

describe('upload editor access', () => {
  it('lets an admin edit series without a separate uploader role', () => {
    expect(canEnterUploadEditor(true, true, false)).toBe(true);
  });
  it('lets an uploader edit uploaded series', () => {
    expect(canEnterUploadEditor(true, false, true)).toBe(true);
  });
  it('does not allow a normal signed-in visitor to edit', () => {
    expect(canEnterUploadEditor(true, false, false)).toBe(false);
  });
  it('requires a signed-in account', () => {
    expect(canEnterUploadEditor(false, true, true)).toBe(false);
  });
});