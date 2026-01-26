import { useCallback, useRef, useState, useEffect } from 'react';

interface GestureState {
  isActive: boolean;
  type: 'volume' | 'brightness' | 'zoom' | null;
  value: number;
  startValue: number;
}

interface UseVideoGesturesProps {
  containerRef: React.RefObject<HTMLDivElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  volume: number;
  onVolumeChange: (volume: number) => void;
  brightness: number;
  onBrightnessChange: (brightness: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  enabled?: boolean;
}

export function useVideoGestures({
  containerRef,
  videoRef,
  volume,
  onVolumeChange,
  brightness,
  onBrightnessChange,
  zoom,
  onZoomChange,
  enabled = true,
}: UseVideoGesturesProps) {
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    type: null,
    value: 0,
    startValue: 0,
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const swipeThreshold = 10; // Minimum pixels to trigger gesture
  const verticalThreshold = 30; // Minimum vertical movement to activate
  const horizontalDeadzone = 50; // Ignore if too much horizontal movement

  // Calculate pinch distance between two touches
  const getPinchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Pinch to zoom - two fingers
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistanceRef.current = getPinchDistance(e.touches);
      setGestureState({
        isActive: true,
        type: 'zoom',
        value: zoom,
        startValue: zoom,
      });
      return;
    }

    // Single finger swipe
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }
  }, [enabled, zoom, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // Handle pinch zoom
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      e.preventDefault();
      const currentDistance = getPinchDistance(e.touches);
      const scale = currentDistance / initialPinchDistanceRef.current;
      const newZoom = Math.max(1, Math.min(3, gestureState.startValue * scale));
      
      setGestureState(prev => ({
        ...prev,
        value: newZoom,
      }));
      onZoomChange(newZoom);
      return;
    }

    // Handle single finger swipe for volume/brightness
    if (e.touches.length === 1 && touchStartRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touchStartRef.current.y - touch.clientY; // Inverted for natural feel
      
      // Check if we're swiping vertically enough
      if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaX) < horizontalDeadzone) {
        e.preventDefault();
        
        const containerRect = container.getBoundingClientRect();
        const touchX = touchStartRef.current.x - containerRect.left;
        const isLeftSide = touchX < containerRect.width / 2;
        
        // Only activate after threshold
        if (Math.abs(deltaY) > verticalThreshold && !gestureState.isActive) {
          if (isLeftSide) {
            setGestureState({
              isActive: true,
              type: 'brightness',
              value: brightness,
              startValue: brightness,
            });
          } else {
            setGestureState({
              isActive: true,
              type: 'volume',
              value: volume,
              startValue: volume,
            });
          }
        }
        
        // Update value based on swipe distance
        if (gestureState.isActive) {
          const sensitivity = 0.005; // Adjust sensitivity
          const delta = deltaY * sensitivity;
          
          if (gestureState.type === 'volume') {
            const newVolume = Math.max(0, Math.min(1, gestureState.startValue + delta));
            setGestureState(prev => ({ ...prev, value: newVolume }));
            onVolumeChange(newVolume);
          } else if (gestureState.type === 'brightness') {
            const newBrightness = Math.max(0.2, Math.min(1.5, gestureState.startValue + delta));
            setGestureState(prev => ({ ...prev, value: newBrightness }));
            onBrightnessChange(newBrightness);
          }
        }
      }
    }
  }, [enabled, containerRef, gestureState, volume, brightness, onVolumeChange, onBrightnessChange, onZoomChange]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    initialPinchDistanceRef.current = null;
    
    // Keep gesture indicator visible briefly
    setTimeout(() => {
      setGestureState({
        isActive: false,
        type: null,
        value: 0,
        startValue: 0,
      });
    }, 500);
  }, []);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    gestureState,
    isGestureActive: gestureState.isActive,
    gestureType: gestureState.type,
    gestureValue: gestureState.value,
  };
}
