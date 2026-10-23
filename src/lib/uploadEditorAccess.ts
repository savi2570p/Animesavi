// Only authenticated, server-resolved staff roles may enter upload editors.
export function canEnterUploadEditor(signedIn: boolean, isAdmin: boolean, isUploader: boolean): boolean {
  return signedIn && (isAdmin || isUploader);
}