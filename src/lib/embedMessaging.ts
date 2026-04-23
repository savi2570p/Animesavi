export const EMBED_MESSAGE_NAMESPACE = 'animesavi.embed';
export const EMBED_MESSAGE_VERSION = 1;

export type EmbedMessageType =
  | 'handshake-request'
  | 'handshake-ack'
  | 'request-state'
  | 'state-update'
  | 'play'
  | 'pause'
  | 'toggle-play'
  | 'seek'
  | 'fullscreen'
  | 'ping'
  | 'pong'
  | 'error';

export interface EmbedRemotePlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  readyState?: number;
}

export interface EmbedMessage {
  namespace: typeof EMBED_MESSAGE_NAMESPACE;
  version: typeof EMBED_MESSAGE_VERSION;
  type: EmbedMessageType;
  instanceId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export function isEmbedMessage(value: unknown): value is EmbedMessage {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<EmbedMessage>;
  return (
    candidate.namespace === EMBED_MESSAGE_NAMESPACE &&
    candidate.version === EMBED_MESSAGE_VERSION &&
    typeof candidate.type === 'string'
  );
}

export function postEmbedMessage(
  targetWindow: Window | null,
  type: EmbedMessageType,
  payload: Record<string, unknown> = {},
  options: { instanceId?: string; targetOrigin?: string } = {},
) {
  if (!targetWindow) return;

  const message: EmbedMessage = {
    namespace: EMBED_MESSAGE_NAMESPACE,
    version: EMBED_MESSAGE_VERSION,
    type,
    instanceId: options.instanceId,
    timestamp: Date.now(),
    payload,
  };

  targetWindow.postMessage(message, options.targetOrigin ?? '*');
}

export function buildEmbedIframeUrl(
  url: string,
  params: Record<string, string | number | boolean> = {},
) {
  try {
    const resolved = new URL(url, window.location.href);

    Object.entries(params).forEach(([key, value]) => {
      resolved.searchParams.set(key, String(value));
    });

    return resolved.toString();
  } catch {
    return url;
  }
}

export function getEmbedUrlMeta(url: string) {
  try {
    const resolved = new URL(url, window.location.href);

    return {
      href: resolved.toString(),
      origin: resolved.origin,
      host: resolved.host,
    };
  } catch {
    return {
      href: url,
      origin: '*',
      host: url,
    };
  }
}

export function getBrowserMediaErrorReason(error?: MediaError | null) {
  if (!error) return 'Unknown browser media error';

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted before the media could finish loading';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'A network error interrupted the media download';
    case MediaError.MEDIA_ERR_DECODE:
      return 'The browser could not decode the media stream';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'The media source format is not supported by the browser';
    default:
      return 'The browser reported an unknown media playback error';
  }
}

export function normalizeEmbedErrorReason(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unexpected embed player error';
}