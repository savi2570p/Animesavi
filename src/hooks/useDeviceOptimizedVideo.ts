import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isIOSDevice, getDeviceType } from '@/lib/deviceUtils';

interface VideoUrlResult {
  videoUrl: string | null;
  hlsUrl: string | null;
  servedFormat: 'original' | 'ios_ready' | 'hls';
  device: string;
  conversionStatus: string;
  needsConversion: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ConversionRecord {
  id: string;
  episode_id: string;
  original_url: string;
  ios_ready_url: string | null;
  status: string;
  needs_conversion: boolean;
}

/**
 * Hook to fetch the optimal video URL based on the user's device.
 * 
 * PLAYBACK PRIORITY:
 * 1. For iOS devices:
 *    - First try HLS (.m3u8) if available
 *    - Fallback to iOS-compatible MP4
 *    - Never block playback waiting for conversion
 * 2. For Android/Windows:
 *    - Serve original video file or MP4
 * 
 * CONVERSION RULES:
 * - MP4 uploads are not blocked
 * - If MP4 is already iOS-compatible, mark ios_ready = true
 * - HLS generation runs asynchronously in background
 * - Playback never depends on HLS readiness
 */
export function useDeviceOptimizedVideo(episodeId: string | undefined, originalVideoUrl: string | null) {
  const [result, setResult] = useState<VideoUrlResult>({
    videoUrl: originalVideoUrl,
    hlsUrl: null,
    servedFormat: 'original',
    device: getDeviceType(),
    conversionStatus: 'none',
    needsConversion: false,
    isLoading: false,
    error: null,
  });

  const fetchOptimizedUrl = useCallback(async () => {
    if (!episodeId || !originalVideoUrl) {
      setResult(prev => ({
        ...prev,
        videoUrl: originalVideoUrl,
        isLoading: false,
      }));
      return;
    }

    const isIOS = isIOSDevice();
    const device = getDeviceType();

    // For non-iOS devices, serve original immediately
    if (!isIOS) {
      setResult({
        videoUrl: originalVideoUrl,
        hlsUrl: null,
        servedFormat: 'original',
        device,
        conversionStatus: 'not_needed',
        needsConversion: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    // For iOS: Check for optimized versions but NEVER block playback
    setResult(prev => ({ ...prev, isLoading: true }));

    try {
      // Check if there's an iOS-ready version available
      const { data: conversion, error } = await supabase
        .from('video_conversions')
        .select('*')
        .eq('episode_id', episodeId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching conversion record:', error);
      }

      const conversionRecord = conversion as ConversionRecord | null;

      // Determine which URL to serve based on availability
      let finalUrl = originalVideoUrl;
      let hlsUrl: string | null = null;
      let servedFormat: 'original' | 'ios_ready' | 'hls' = 'original';

      // Check if original is already MP4 (likely iOS compatible)
      const isOriginalMp4 = originalVideoUrl.toLowerCase().includes('.mp4');

      if (conversionRecord?.status === 'completed' && conversionRecord.ios_ready_url) {
        // Use iOS-ready MP4 version
        finalUrl = conversionRecord.ios_ready_url;
        servedFormat = 'ios_ready';
      } else if (isOriginalMp4) {
        // Original MP4 can be played directly on iOS
        finalUrl = originalVideoUrl;
        servedFormat = 'original';
      }
      // Note: If no converted version and not MP4, still try original
      // iOS may still play some formats or fail gracefully

      setResult({
        videoUrl: finalUrl,
        hlsUrl,
        servedFormat,
        device: 'ios',
        conversionStatus: conversionRecord?.status || (isOriginalMp4 ? 'not_needed' : 'none'),
        needsConversion: conversionRecord?.needs_conversion || false,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error in useDeviceOptimizedVideo:', err);
      // On error, still provide original URL - don't block playback
      setResult({
        videoUrl: originalVideoUrl,
        hlsUrl: null,
        servedFormat: 'original',
        device: 'ios',
        conversionStatus: 'error',
        needsConversion: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [episodeId, originalVideoUrl]);

  useEffect(() => {
    fetchOptimizedUrl();
  }, [fetchOptimizedUrl]);

  return result;
}

/**
 * Hook to get all video conversion stats for admin dashboard
 */
export function useVideoConversionStats() {
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('video_conversions')
          .select('status');

        if (error) throw error;

        const statusCounts = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
        };

        data?.forEach((row: { status: string }) => {
          if (row.status in statusCounts) {
            statusCounts[row.status as keyof typeof statusCounts]++;
          }
        });

        setStats({
          ...statusCounts,
          total: data?.length || 0,
        });
      } catch (err) {
        console.error('Error fetching conversion stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading };
}
