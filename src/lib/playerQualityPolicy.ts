/**
 * Data Saver caps playback at 1080p; otherwise the page's quality lock (4K) applies on
 * every device, so the player shows the locked quality instead of "Auto".
 */
export function effectivePlayerQuality(dataSaver: boolean, _mobile: boolean, lockedQuality?: number) {
  return dataSaver ? 1080 : lockedQuality;
}
