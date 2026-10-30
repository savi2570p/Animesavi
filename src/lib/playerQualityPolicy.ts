export function effectivePlayerQuality(dataSaver: boolean, mobile: boolean, lockedQuality?: number) {
  return dataSaver ? 1080 : mobile ? undefined : lockedQuality;
}