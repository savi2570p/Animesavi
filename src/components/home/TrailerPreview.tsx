import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Volume2, VolumeX } from 'lucide-react';
import Hls from 'hls.js';

interface TrailerPreviewProps {
  animeId: string;
  coverImage: string | null;
  title: string;
  onClose: () => void;
}

export function TrailerPreview({ animeId, coverImage, title, onClose }: TrailerPreviewProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    fetchFirstEpisodeVideo();
  }, [animeId]);

  const fetchFirstEpisodeVideo = async () => {
    try {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('anime_id', animeId)
        .order('season_number')
        .limit(1);

      if (!seasons || seasons.length === 0) {
        setLoading(false);
        return;
      }

      const { data: episodes } = await supabase
        .from('episodes')
        .select('video_url, external_url')
        .eq('season_id', seasons[0].id)
        .order('episode_number')
        .limit(1);

      if (episodes && episodes.length > 0) {
        const ep = episodes[0];
        const url = ep.video_url || ep.external_url;
        if (url && (url.endsWith('.mp4') || url.endsWith('.m3u8') || url.includes('supabase'))) {
          setVideoUrl(url);
        }
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    const video = videoRef.current;
    const isHLS = videoUrl.includes('.m3u8');
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: isMobile ? 10 : 15,
          maxMaxBufferLength: isMobile ? 20 : 30,
          maxBufferHole: 0.5,
          startLevel: isMobile ? 0 : -1,
          abrBandWidthFactor: isMobile ? 1.5 : 0.95,
          manifestLoadingTimeOut: 15000,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });

        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.currentTime = 0;
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('HLS error in trailer:', data);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = 0;
          video.play().catch(() => {});
        });
      }
    } else {
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', () => {
        video.currentTime = 0;
        video.play().catch(() => {});
      });
    }
  }, [videoUrl]);

  if (loading) {
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl z-10">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!videoUrl) {
    // Show animated cover with preview text
    return (
      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center rounded-xl z-10">
        <img
          src={coverImage || '/placeholder.svg'}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-30 animate-pulse"
        />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="p-4 rounded-full bg-primary/90 shadow-lg animate-pulse">
            <Play className="h-6 w-6 text-primary-foreground fill-current" />
          </div>
          <span className="text-xs font-medium text-white/80">Preview unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden z-10">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted={muted}
        autoPlay
        loop
        playsInline
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        x5-video-player-type="h5-page"
        x5-video-player-fullscreen="false"
        x5-playsinline="true"
        preload="metadata"
        controlsList="nodownload noremoteplayback"
      />
      
      {/* Overlay controls */}
      <div className="absolute bottom-2 right-2 flex gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMuted(!muted);
          }}
          className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
        >
          {muted ? (
            <VolumeX className="h-3 w-3 text-white" />
          ) : (
            <Volume2 className="h-3 w-3 text-white" />
          )}
        </button>
      </div>
      
      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
        <p className="text-sm font-semibold text-white line-clamp-1">{title}</p>
        <p className="text-xs text-white/70">Preview</p>
      </div>
    </div>
  );
}
