import { useState, useEffect, useCallback } from 'react';

interface NetworkSpeedResult {
  downloadSpeed: number; // in Mbps
  latency: number; // in ms
  connectionType: string;
  effectiveType: string;
  recommendedQuality: '360p' | '480p' | '720p' | '1080p' | '4K';
  isSlowNetwork: boolean;
  isCellular: boolean;
  lastTestTime: number;
  isTesting: boolean;
  error: string | null;
}

const SPEED_TEST_CACHE_KEY = 'network_speed_test_result';
const SPEED_TEST_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Test file URL - using a small public file for speed testing
const TEST_FILE_SIZE = 100000; // bytes
const TEST_URL = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

export function useNetworkSpeed(): NetworkSpeedResult & { runSpeedTest: () => Promise<void> } {
  const [result, setResult] = useState<NetworkSpeedResult>({
    downloadSpeed: 0,
    latency: 0,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    recommendedQuality: '720p',
    isSlowNetwork: false,
    isCellular: false,
    lastTestTime: 0,
    isTesting: false,
    error: null,
  });

  const getRecommendedQuality = useCallback((speedMbps: number): '360p' | '480p' | '720p' | '1080p' | '4K' => {
    if (speedMbps < 1) return '360p';
    if (speedMbps < 2.5) return '480p';
    if (speedMbps < 5) return '720p';
    if (speedMbps < 15) return '1080p';
    return '4K';
  }, []);

  const getNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0, // in Mbps
        rtt: connection.rtt || 0, // in ms
        saveData: connection.saveData || false,
      };
    }
    
    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
    };
  }, []);

  const runSpeedTest = useCallback(async () => {
    setResult(prev => ({ ...prev, isTesting: true, error: null }));

    const networkInfo = getNetworkInfo();
    const isCellular = networkInfo.connectionType === 'cellular';
    const isSlowEffective = ['slow-2g', '2g'].includes(networkInfo.effectiveType);

    try {
      // Measure latency first
      const latencyStart = performance.now();
      await fetch(TEST_URL, { method: 'HEAD', cache: 'no-cache' });
      const latency = Math.round(performance.now() - latencyStart);

      // Measure download speed
      const downloadStart = performance.now();
      const response = await fetch(TEST_URL + '?t=' + Date.now(), { cache: 'no-cache' });
      const blob = await response.blob();
      const downloadEnd = performance.now();

      const downloadTime = (downloadEnd - downloadStart) / 1000; // seconds
      const fileSizeBytes = blob.size || TEST_FILE_SIZE;
      const speedBps = (fileSizeBytes * 8) / downloadTime;
      const speedMbps = speedBps / 1000000;

      // Use Network Information API as a fallback/validation
      const estimatedSpeed = networkInfo.downlink > 0 
        ? Math.max(speedMbps, networkInfo.downlink * 0.7) // Use higher of measured or 70% of reported
        : speedMbps;

      const recommendedQuality = getRecommendedQuality(estimatedSpeed);
      const isSlowNetwork = estimatedSpeed < 2 || isSlowEffective || networkInfo.saveData;

      const newResult: NetworkSpeedResult = {
        downloadSpeed: Math.round(estimatedSpeed * 100) / 100,
        latency,
        connectionType: networkInfo.connectionType,
        effectiveType: networkInfo.effectiveType,
        recommendedQuality,
        isSlowNetwork,
        isCellular,
        lastTestTime: Date.now(),
        isTesting: false,
        error: null,
      };

      // Cache the result
      localStorage.setItem(SPEED_TEST_CACHE_KEY, JSON.stringify(newResult));
      setResult(newResult);

    } catch (error) {
      console.error('Speed test failed:', error);
      
      // Fallback to Network Information API
      const fallbackSpeed = networkInfo.downlink || 5;
      const recommendedQuality = getRecommendedQuality(fallbackSpeed);
      
      setResult({
        downloadSpeed: fallbackSpeed,
        latency: networkInfo.rtt || 100,
        connectionType: networkInfo.connectionType,
        effectiveType: networkInfo.effectiveType,
        recommendedQuality,
        isSlowNetwork: fallbackSpeed < 2 || isSlowEffective,
        isCellular,
        lastTestTime: Date.now(),
        isTesting: false,
        error: 'Speed test failed, using estimated values',
      });
    }
  }, [getNetworkInfo, getRecommendedQuality]);

  // Check cached result on mount
  useEffect(() => {
    const cached = localStorage.getItem(SPEED_TEST_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NetworkSpeedResult;
        if (Date.now() - parsed.lastTestTime < SPEED_TEST_CACHE_DURATION) {
          setResult({ ...parsed, isTesting: false });
          return;
        }
      } catch (e) {
        // Invalid cache, run new test
      }
    }

    const info = getNetworkInfo();

    // Never spend the user's data on a benchmark when they asked us not to,
    // or when the browser already reports a usable downlink estimate.
    if (info.saveData || info.downlink > 0) {
      const speed = info.saveData ? Math.min(info.downlink || 1, 1) : info.downlink;
      setResult({
        downloadSpeed: Math.round(speed * 100) / 100,
        latency: info.rtt || 0,
        connectionType: info.connectionType,
        effectiveType: info.effectiveType,
        recommendedQuality: getRecommendedQuality(speed),
        isSlowNetwork: speed < 2 || info.saveData || ['slow-2g', '2g'].includes(info.effectiveType),
        isCellular: info.connectionType === 'cellular',
        lastTestTime: Date.now(),
        isTesting: false,
        error: null,
      });
      return;
    }

    // Otherwise measure — but only once the browser is idle, so the benchmark
    // never competes with first paint or the initial data fetches.
    let cancelled = false;
    const run = () => { if (!cancelled) void runSpeedTest(); };
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    const handle = ric ? ric(run, { timeout: 4000 }) : window.setTimeout(run, 2500);

    return () => {
      cancelled = true;
      const cic = (window as unknown as {
        cancelIdleCallback?: (h: number) => void;
      }).cancelIdleCallback;
      if (ric && cic) cic(handle as number);
      else window.clearTimeout(handle as number);
    };
  }, [runSpeedTest, getNetworkInfo, getRecommendedQuality]);

  // Listen for network changes
  useEffect(() => {
    const connection = (navigator as any).connection;
    if (connection) {
      // Network change events can fire in rapid bursts (e.g. moving between
      // cells); debounce so we do not launch a benchmark per event.
      let timer = 0;
      const handleChange = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void runSpeedTest(); }, 3000);
      };
      connection.addEventListener('change', handleChange);
      return () => {
        window.clearTimeout(timer);
        connection.removeEventListener('change', handleChange);
      };
    }
  }, [runSpeedTest]);

  return { ...result, runSpeedTest };
}

// Create a singleton context for global access
export const getStoredNetworkSpeed = (): NetworkSpeedResult | null => {
  const cached = localStorage.getItem(SPEED_TEST_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
};
