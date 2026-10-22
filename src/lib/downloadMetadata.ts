/** File size is optional: never keep download preparation waiting on a host. */
export async function readDownloadSize(url: string, signal: AbortSignal): Promise<number | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const probe = async () => {
    try {
      const head = await fetch(url, { method: 'HEAD', signal: controller.signal });
      const size = Number(head.headers.get('content-length'));
      if (head.ok && size > 0) return size;
    } catch { /* Some CDNs disallow HEAD. */ }
    if (controller.signal.aborted) return null;
    const response = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: controller.signal });
    // Cancel even when the server ignores Range; do not stream a movie as a probe.
    await response.body?.cancel();
    const total = response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    return response.status === 206 && total ? Number(total) : null;
  };
  try {
    return await Promise.race([
      probe().catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(null); }, 6000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    signal.removeEventListener('abort', abort);
  }
}