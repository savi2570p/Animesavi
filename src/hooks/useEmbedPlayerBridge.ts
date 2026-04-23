import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';

import { getBrowserMediaErrorReason, getEmbedUrlMeta, isEmbedMessage, postEmbedMessage, type EmbedRemotePlaybackState } from '@/lib/embedMessaging';

interface UseEmbedPlayerBridgeOptions {
  videoRef: RefObject<HTMLVideoElement>;
  getPlaybackState: () => EmbedRemotePlaybackState;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  toggleFullscreen: () => void | Promise<void>;
  errorReason?: string | null;
}

export function useEmbedPlayerBridge({
  videoRef,
  getPlaybackState,
  play,
  pause,
  togglePlay,
  seek,
  toggleFullscreen,
  errorReason,
}: UseEmbedPlayerBridgeOptions) {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const parentOrigin = searchParams.get('parentOrigin') ?? '*';
  const instanceId = searchParams.get('embedInstanceId') ?? undefined;
  const targetMeta = useMemo(() => getEmbedUrlMeta(parentOrigin), [parentOrigin]);

  useEffect(() => {
    if (window.parent === window) return;

    const emitState = () => {
      postEmbedMessage(window.parent, 'state-update', { ...getPlaybackState() }, {
        instanceId,
        targetOrigin: targetMeta.origin,
      });
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isEmbedMessage(event.data)) return;
      if (instanceId && event.data.instanceId && event.data.instanceId !== instanceId) return;
      if (targetMeta.origin !== '*' && event.origin !== targetMeta.origin) return;

      switch (event.data.type) {
        case 'handshake-request':
          postEmbedMessage(window.parent, 'handshake-ack', { ...getPlaybackState() }, {
            instanceId,
            targetOrigin: targetMeta.origin,
          });
          emitState();
          break;
        case 'request-state':
          emitState();
          break;
        case 'play':
          play();
          break;
        case 'pause':
          pause();
          break;
        case 'toggle-play':
          togglePlay();
          break;
        case 'seek':
          seek(Number(event.data.payload?.time ?? 0));
          break;
        case 'fullscreen':
          void toggleFullscreen();
          break;
        case 'ping':
          postEmbedMessage(window.parent, 'pong', { ...getPlaybackState() }, {
            instanceId,
            targetOrigin: targetMeta.origin,
          });
          break;
        default:
          break;
      }
    };

    const video = videoRef.current;
    const syncEvents = ['play', 'pause', 'timeupdate', 'volumechange', 'loadedmetadata', 'durationchange', 'seeking', 'seeked', 'waiting', 'playing'];

    window.addEventListener('message', handleMessage);
    syncEvents.forEach((eventName) => video?.addEventListener(eventName, emitState));
    document.addEventListener('fullscreenchange', emitState);
    document.addEventListener('webkitfullscreenchange', emitState as EventListener);

    emitState();

    return () => {
      window.removeEventListener('message', handleMessage);
      syncEvents.forEach((eventName) => video?.removeEventListener(eventName, emitState));
      document.removeEventListener('fullscreenchange', emitState);
      document.removeEventListener('webkitfullscreenchange', emitState as EventListener);
    };
  }, [getPlaybackState, instanceId, pause, play, seek, targetMeta.origin, toggleFullscreen, togglePlay, videoRef]);

  useEffect(() => {
    if (!errorReason || window.parent === window) return;

    postEmbedMessage(
      window.parent,
      'error',
      {
        reason: errorReason,
        browserReason: getBrowserMediaErrorReason(videoRef.current?.error),
      },
      {
        instanceId,
        targetOrigin: targetMeta.origin,
      },
    );
  }, [errorReason, instanceId, targetMeta.origin, videoRef]);
}