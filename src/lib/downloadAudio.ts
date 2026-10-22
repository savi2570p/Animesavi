export interface DownloadAudioTrack {
  label: string;
  language: string;
}

/** Read container metadata only; never fetch the entire movie to list languages. */
export async function discoverDownloadAudio(url: string, signal: AbortSignal): Promise<DownloadAudioTrack[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound both headers and body reads; some hosts leave Range requests pending.
    return await Promise.race([
      readDownloadAudio(url, controller.signal).catch(() => []),
      new Promise<DownloadAudioTrack[]>((resolve) => {
        timer = setTimeout(() => { controller.abort(); resolve([]); }, 6000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    signal.removeEventListener('abort', abort);
  }
}

async function readDownloadAudio(url: string, signal: AbortSignal): Promise<DownloadAudioTrack[]> {
  if (signal.aborted) return [];
  const { createFile, MP4BoxBuffer } = await import('mp4box');
  const file = createFile(false);
  let tracks: DownloadAudioTrack[] | undefined;
  file.onReady = (info) => {
    tracks = info.audioTracks.map((track, index) => ({
      label: `Audio ${index + 1}`,
      language: track.language || 'und',
    }));
  };
  let offset = 0;
  const chunkSize = 256 * 1024;
  for (let request = 0; request < 8 && !signal.aborted && !tracks; request++) {
    const response = await fetch(url, {
      headers: { Range: `bytes=${offset}-${offset + chunkSize - 1}` }, signal,
    });
    // Refuse servers ignoring Range: opening this popup must not download a movie.
    if (response.status !== 206) {
      await response.body?.cancel();
      break;
    }
    const data = await response.arrayBuffer();
    if (data.byteLength > chunkSize || !data.byteLength) break;
    const next = file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(data, offset));
    if (tracks) break;
    offset = Number.isFinite(next) ? Math.max(next, offset + data.byteLength) : offset + data.byteLength;
  }
  return tracks || [];
}

export function pauseForDownload(video: Pick<HTMLVideoElement, 'pause'> | null) {
  video?.pause();
}