import { useState, useEffect, useCallback } from 'react';
import type { ServerType } from '@/hooks/useServerAutoSelect';

const SERVER_PREFERENCE_KEY = 'preferred_video_server';
const SERVER_PERFORMANCE_KEY = 'server_performance_data';

export type { ServerType } from '@/hooks/useServerAutoSelect';

interface ServerPerformance {
  server: ServerType;
  loadTime: number;
  successCount: number;
  failCount: number;
  lastUsed: number;
}

export function useServerPreference() {
  const [preferredServer, setPreferredServer] = useState<ServerType>('PLAY');
  const [performanceData, setPerformanceData] = useState<Map<ServerType, ServerPerformance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Load saved preference and performance data on mount
  useEffect(() => {
    try {
      const savedServer = localStorage.getItem(SERVER_PREFERENCE_KEY) as ServerType | null;
      if (savedServer && ['PLAY', 'SHORT', 'Zex'].includes(savedServer)) {
        setPreferredServer(savedServer);
      }

      const savedPerformance = localStorage.getItem(SERVER_PERFORMANCE_KEY);
      if (savedPerformance) {
        const parsed = JSON.parse(savedPerformance);
        const map = new Map<ServerType, ServerPerformance>();
        Object.entries(parsed).forEach(([key, value]) => {
          map.set(key as ServerType, value as ServerPerformance);
        });
        setPerformanceData(map);
      }
    } catch (error) {
      console.error('Error loading server preferences:', error);
    }
  }, []);

  // Save preference to localStorage
  const savePreference = useCallback((server: ServerType) => {
    setPreferredServer(server);
    localStorage.setItem(SERVER_PREFERENCE_KEY, server);
  }, []);

  // Record server performance
  const recordPerformance = useCallback((server: ServerType, loadTime: number, success: boolean) => {
    setPerformanceData(prev => {
      const existing = prev.get(server) || {
        server,
        loadTime: 0,
        successCount: 0,
        failCount: 0,
        lastUsed: Date.now()
      };

      const updated: ServerPerformance = {
        server,
        loadTime: success ? (existing.loadTime * existing.successCount + loadTime) / (existing.successCount + 1) : existing.loadTime,
        successCount: success ? existing.successCount + 1 : existing.successCount,
        failCount: success ? existing.failCount : existing.failCount + 1,
        lastUsed: Date.now()
      };

      const newMap = new Map(prev);
      newMap.set(server, updated);

      // Persist to localStorage
      const obj: Record<string, ServerPerformance> = {};
      newMap.forEach((value, key) => {
        obj[key] = value;
      });
      localStorage.setItem(SERVER_PERFORMANCE_KEY, JSON.stringify(obj));

      return newMap;
    });
  }, []);

  // Get best server based on performance data
  const getBestServer = useCallback((): ServerType => {
    if (performanceData.size === 0) return preferredServer;

    let bestServer: ServerType = preferredServer;
    let bestScore = -1;

    performanceData.forEach((data, server) => {
      const totalAttempts = data.successCount + data.failCount;
      if (totalAttempts === 0) return;

      const successRate = data.successCount / totalAttempts;
      const normalizedLoadTime = Math.max(0, 1 - data.loadTime / 10000); // Normalize to 0-1, 10s max
      const score = successRate * 0.7 + normalizedLoadTime * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestServer = server;
      }
    });

    return bestServer;
  }, [performanceData, preferredServer]);

  // Switch server with smooth transition
  const switchServer = useCallback(async (server: ServerType): Promise<boolean> => {
    if (server === preferredServer) return true;

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Simulate server switch with minimal delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      savePreference(server);
      recordPerformance(server, Date.now() - startTime, true);
      setIsLoading(false);
      return true;
    } catch (error) {
      recordPerformance(server, Date.now() - startTime, false);
      setIsLoading(false);
      return false;
    }
  }, [preferredServer, savePreference, recordPerformance]);

  // Get server stats for display
  const getServerStats = useCallback((server: ServerType) => {
    const data = performanceData.get(server);
    if (!data) return { reliability: 100, avgLoadTime: 0 };

    const totalAttempts = data.successCount + data.failCount;
    return {
      reliability: totalAttempts > 0 ? Math.round((data.successCount / totalAttempts) * 100) : 100,
      avgLoadTime: Math.round(data.loadTime)
    };
  }, [performanceData]);

  return {
    preferredServer,
    isLoading,
    savePreference,
    switchServer,
    recordPerformance,
    getBestServer,
    getServerStats
  };
}
