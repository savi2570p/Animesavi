export const IMAGE_DATA_CACHES = ['images-cache', 'gcp-images-cache'];
export async function clearImageData(storage: Storage, cacheStorage?: CacheStorage) {
  if (cacheStorage) {
    const names = await cacheStorage.keys();
    await Promise.all(names.filter(name => IMAGE_DATA_CACHES.includes(name)).map(name => cacheStorage.delete(name)));
  }
  for (const key of Object.keys(storage)) {
    if (key.startsWith('resume:')) storage.removeItem(key);
  }
}