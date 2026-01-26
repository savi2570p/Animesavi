import { useEffect, useRef, useCallback, useState } from 'react';
import Hls from 'hls.js';

interface Episode {
  id: string;
  video_url?: string | null;
  external_url?: string | null;
}

interface PreloadStatus {
  episodeId: string;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  progress: number;
}

export function useVideoPreloader(
  currentEpisodeId: string,
  episodes: Episode[],
  enabled: boolean = true
) {
  const [preloadStatus, setPreloadStatus] = useState<PreloadStatus | null>(null);
  const preloadHlsRef = useRef<Hls | null>(null);
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Find the next episode
  const getNextEpisode = useCallback(() => {
    const currentIndex = episodes.findIndex(ep => ep.id === currentEpisodeId);
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      return episodes[currentIndex + 1];
    }
    return null;
  }, [currentEpisodeId, episodes]);
  
  // Check if URL is HLS stream
  const isHlsUrl = (url: string): boolean => {
    return /\.m3u8(\?.*)?$/i.test(url) || url.includes('.m3u8');
  };
  
  // Preload the next episode
  const preloadNextEpisode = useCallback(() => {
    if (!enabled) return;
    
    const nextEpisode = getNextEpisode();
    if (!nextEpisode) return;
    
    const videoUrl = nextEpisode.video_url || nextEpisode.external_url;
    if (!videoUrl) return;
    
    // Don't re-preload if already loading/loaded
    if (preloadStatus?.episodeId === nextEpisode.id && 
        ['loading', 'loaded'].includes(preloadStatus.status)) {
      return;
    }
    
    console.log('Preloading next episode:', nextEpisode.id);
    
    setPreloadStatus({
      episodeId: nextEpisode.id,
      status: 'loading',
      progress: 0,
    });
    
    // Cleanup previous preload
    if (preloadHlsRef.current) {
      preloadHlsRef.current.destroy();
      preloadHlsRef.current = null;
    }
    
    if (preloadVideoRef.current) {
      preloadVideoRef.current.src = '';
      preloadVideoRef.current.load();
    }
    
    // Create hidden video element for preloading
    if (!preloadVideoRef.current) {
      preloadVideoRef.current = document.createElement('video');
      preloadVideoRef.current.muted = true;
      preloadVideoRef.current.preload = 'auto';
      preloadVideoRef.current.style.display = 'none';
      document.body.appendChild(preloadVideoRef.current);
    }
    
    const video = preloadVideoRef.current;
    
    if (isHlsUrl(videoUrl) && Hls.isSupported()) {
      // Use HLS.js for HLS streams
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 10, // Only buffer first 10 seconds
        maxMaxBufferLength: 30,
        startLevel: 0, // Start with lowest quality for preloading
        autoStartLoad: true,
      });
      
      preloadHlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      
      let segmentsLoaded = 0;
      const targetSegments = 3; // Preload first 3 segments
      
      hls.on(Hls.Events.FRAG_LOADED, () => {
        segmentsLoaded++;
        const progress = Math.min(100, (segmentsLoaded / targetSegments) * 100);
        
        setPreloadStatus(prev => prev ? {
          ...prev,
          progress,
        } : null);
        
        if (segmentsLoaded >= targetSegments) {
          hls.stopLoad();
          setPreloadStatus(prev => prev ? {
            ...prev,
            status: 'loaded',
            progress: 100,
          } : null);
          console.log('Next episode preloaded:', nextEpisode.id);
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('Preload error:', data);
          setPreloadStatus(prev => prev ? {
            ...prev,
            status: 'error',
          } : null);
        }
      });
    } else {
      // Direct video preloading for MP4
      video.src = videoUrl;
      
      const handleProgress = () => {
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(0);
          const targetBuffer = 10; // Buffer first 10 seconds
          const progress = Math.min(100, (bufferedEnd / targetBuffer) * 100);
          
          setPreloadStatus(prev => prev ? {
            ...prev,
            progress,
          } : null);
          
          if (bufferedEnd >= targetBuffer || progress >= 100) {
            setPreloadStatus(prev => prev ? {
              ...prev,
              status: 'loaded',
              progress: 100,
            } : null);
            console.log('Next episode preloaded:', nextEpisode.id);
          }
        }
      };
      
      const handleError = () => {
        console.error('Preload error for:', videoUrl);
        setPreloadStatus(prev => prev ? {
          ...prev,
          status: 'error',
        } : null);
      };
      
      video.addEventListener('progress', handleProgress);
      video.addEventListener('error', handleError);
      video.load();
    }
  }, [enabled, getNextEpisode, preloadStatus]);
  
  // Start preloading after watching for a bit
  useEffect(() => {
    if (!enabled) return;
    
    // Start preloading after 30 seconds of watching
    preloadTimeoutRef.current = setTimeout(() => {
      preloadNextEpisode();
    }, 30000);
    
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [currentEpisodeId, enabled, preloadNextEpisode]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadHlsRef.current) {
        preloadHlsRef.current.destroy();
        preloadHlsRef.current = null;
      }
      
      if (preloadVideoRef.current) {
        preloadVideoRef.current.src = '';
        preloadVideoRef.current.load();
        preloadVideoRef.current.remove();
        preloadVideoRef.current = null;
      }
      
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);
  
  // Expose method to trigger preload immediately
  const triggerPreload = useCallback(() => {
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    preloadNextEpisode();
  }, [preloadNextEpisode]);
  
  return {
    preloadStatus,
    nextEpisode: getNextEpisode(),
    triggerPreload,
  };
}
