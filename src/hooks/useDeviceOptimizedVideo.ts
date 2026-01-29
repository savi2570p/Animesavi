import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isIOSDevice, getDeviceType } from '@/lib/deviceUtils';

interface VideoUrlResult {
  videoUrl: string | null;
  servedFormat: 'original' | 'ios_ready';
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
 * For iOS devices, it will try to serve an iOS-compatible version if available.
 * For Android/Windows, it serves the original file.
 */
export function useDeviceOptimizedVideo(episodeId: string | undefined, originalVideoUrl: string | null) {
  const [result, setResult] = useState<VideoUrlResult>({
    videoUrl: originalVideoUrl,
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

    // Only check for iOS-optimized version if on iOS
    if (!isIOSDevice()) {
      setResult({
        videoUrl: originalVideoUrl,
        servedFormat: 'original',
        device: getDeviceType(),
        conversionStatus: 'not_needed',
        needsConversion: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    setResult(prev => ({ ...prev, isLoading: true }));

    try {
      // Check if there's an iOS-ready version available
      const { data: conversion, error } = await supabase
        .from('video_conversions')
        .select('*')
        .eq('episode_id', episodeId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        console.error('Error fetching conversion record:', error);
      }

      const conversionRecord = conversion as ConversionRecord | null;

      // Determine which URL to serve
      let finalUrl = originalVideoUrl;
      let servedFormat: 'original' | 'ios_ready' = 'original';

      if (conversionRecord?.status === 'completed' && conversionRecord.ios_ready_url) {
        finalUrl = conversionRecord.ios_ready_url;
        servedFormat = 'ios_ready';
      }

      setResult({
        videoUrl: finalUrl,
        servedFormat,
        device: 'ios',
        conversionStatus: conversionRecord?.status || 'none',
        needsConversion: conversionRecord?.needs_conversion || false,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error in useDeviceOptimizedVideo:', err);
      setResult({
        videoUrl: originalVideoUrl,
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
