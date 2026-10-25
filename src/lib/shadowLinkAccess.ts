// Controls link-sharing visibility only, not administrator or playback permissions.
const SHADOW_LINK_EMAILS = new Set([
  'savi2570p@gmail.com',
  'shadowtoonsindia@gmail.com',
  'shadowflixxorg@gmail.com',
]);

export function canSeeShadowLinks(email?: string | null): boolean {
  return typeof email === 'string' && SHADOW_LINK_EMAILS.has(email.trim().toLowerCase());
}