import { useEffect, type RefObject } from 'react';
import { readEmbedResume, saveEmbedResume } from '@/lib/embedResume';

/** Exact checkpoints from native media, never estimated iframe watch time. */
export function useEmbedResume(videoRef: RefObject<HTMLVideoElement>, episodeId: string | null | undefined, source: string | null | undefined, explicitTime?: number, enabled = true) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !episodeId || !source || !enabled) return;
    let restored = false;
    let lastSave = 0;
    const restore = () => {
      if (restored || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const time = readEmbedResume(episodeId, video.duration, explicitTime);
      try {
        if (time > 0) video.currentTime = time;
        restored = true;
      } catch { /* Retry once media becomes seekable. */ }
    };
    const save = () => {
      if (restored) saveEmbedResume(episodeId, video.currentTime, video.duration, video.ended);
    };
    const tick = () => {
      if (Date.now() - lastSave < 3000) return;
      lastSave = Date.now();
      save();
    };
    const hidden = () => { if (document.hidden) save(); };
    video.addEventListener('loadedmetadata', restore);
    video.addEventListener('canplay', restore);
    video.addEventListener('timeupdate', tick);
    video.addEventListener('pause', save);
    video.addEventListener('seeked', save);
    video.addEventListener('ended', save);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hidden);
    if (video.readyState >= 1) restore();
    return () => {
      save();
      video.removeEventListener('loadedmetadata', restore);
      video.removeEventListener('canplay', restore);
      video.removeEventListener('timeupdate', tick);
      video.removeEventListener('pause', save);
      video.removeEventListener('seeked', save);
      video.removeEventListener('ended', save);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [videoRef, episodeId, source, explicitTime, enabled]);
}