import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

export interface MiniPlayerVideo {
  videoUrl: string;
  title: string;
  animeTitle: string;
  episodeNumber: number;
  episodeId: string;
  poster?: string;
  currentTime?: number;
}

interface MiniPlayerContextType {
  video: MiniPlayerVideo | null;
  isActive: boolean;
  isMinimized: boolean;
  startMiniPlayer: (video: MiniPlayerVideo) => void;
  stopMiniPlayer: () => void;
  minimizeMiniPlayer: () => void;
  maximizeMiniPlayer: () => void;
  updateTime: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const MiniPlayerContext = createContext<MiniPlayerContextType | undefined>(undefined);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [video, setVideo] = useState<MiniPlayerVideo | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startMiniPlayer = useCallback((newVideo: MiniPlayerVideo) => {
    setVideo(newVideo);
    setIsActive(true);
    setIsMinimized(true);
  }, []);

  const stopMiniPlayer = useCallback(() => {
    setVideo(null);
    setIsActive(false);
    setIsMinimized(false);
  }, []);

  const minimizeMiniPlayer = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizeMiniPlayer = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const updateTime = useCallback((time: number) => {
    setVideo(prev => prev ? { ...prev, currentTime: time } : null);
  }, []);

  return (
    <MiniPlayerContext.Provider
      value={{
        video,
        isActive,
        isMinimized,
        startMiniPlayer,
        stopMiniPlayer,
        minimizeMiniPlayer,
        maximizeMiniPlayer,
        updateTime,
        videoRef,
      }}
    >
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const context = useContext(MiniPlayerContext);
  if (context === undefined) {
    throw new Error('useMiniPlayer must be used within a MiniPlayerProvider');
  }
  return context;
}
