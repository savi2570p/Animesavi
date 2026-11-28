import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

/** Resolve only the requested file; cache lookups across manual server changes. */
export function useDeviceOptimizedVideo(episodeId: string | undefined, originalVideoUrl: string | null) {
  const device = getDeviceType();
  const { data, isFetching, error } = useQuery({
    queryKey: ['playback-source', episodeId, originalVideoUrl, device],
    enabled: !!episodeId && !!originalVideoUrl,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<VideoUrlResult> => {
      const fallback: VideoUrlResult = {
        videoUrl: originalVideoUrl, hlsUrl: null, servedFormat: 'original', device,
        conversionStatus: 'not_needed', needsConversion: false, isLoading: false, error: null,
      };
      if (!episodeId || !originalVideoUrl || /\.m3u8(?:[?#]|$)/i.test(originalVideoUrl)) return fallback;
      const { data: conversion, error } = await supabase
        .from('video_conversions')
        .select('original_url, hls_url, ios_ready_url, status, needs_conversion')
        .eq('episode_id', episodeId)
        .eq('original_url', originalVideoUrl)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      if (!conversion) return fallback;
      const hlsUrl = conversion.hls_url;
      const iosUrl = isIOSDevice() && conversion.status === 'completed' ? conversion.ios_ready_url : null;
      return {
        ...fallback,
        videoUrl: hlsUrl || iosUrl || originalVideoUrl,
        hlsUrl,
        servedFormat: hlsUrl ? 'hls' : iosUrl ? 'ios_ready' : 'original',
        conversionStatus: conversion.status,
        needsConversion: conversion.needs_conversion ?? false,
      };
    },
  });
  // Never leak the last episode's URL while the next lookup is pending.
  return data ?? {
    videoUrl: originalVideoUrl, hlsUrl: null, servedFormat: 'original' as const, device,
    conversionStatus: 'none', needsConversion: false, isLoading: isFetching,
    error: error instanceof Error ? error.message : null,
  };
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
