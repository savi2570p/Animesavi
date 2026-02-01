import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that automatically scans for unconverted MKV videos on app startup.
 * Only runs for admin/uploader users and limits to once per session.
 */
export function useAutoVideoScan() {
  const { isAdmin, isUploader } = useAuth();
  const [hasScanned, setHasScanned] = useState(false);
  const [scanResult, setScanResult] = useState<{
    created: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanAttemptedRef = useRef(false);

  useEffect(() => {
    // Only run scan for admins or uploaders
    if (!isAdmin && !isUploader) return;
    
    // Prevent multiple scan attempts in the same session
    if (scanAttemptedRef.current) return;
    
    // Check if we've already scanned in this browser session
    const lastScan = sessionStorage.getItem('auto_video_scan_timestamp');
    if (lastScan) {
      const lastScanTime = parseInt(lastScan, 10);
      const hoursSinceLastScan = (Date.now() - lastScanTime) / (1000 * 60 * 60);
      // Only scan once per hour
      if (hoursSinceLastScan < 1) {
        return;
      }
    }

    scanAttemptedRef.current = true;
    
    const runBackgroundScan = async () => {
      setIsScanning(true);
      try {
        console.log('[AutoVideoScan] Starting background scan for unconverted videos...');
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-conversion?action=scan-existing`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({}),
          }
        );

        const result = await response.json();

        if (result.error) {
          console.error('[AutoVideoScan] Scan error:', result.error);
          return;
        }

        console.log(`[AutoVideoScan] Scan complete: ${result.created} new records created, ${result.skipped} already existed`);
        
        setScanResult({
          created: result.created || 0,
          skipped: result.skipped || 0,
          total: result.total || 0,
        });
        
        setHasScanned(true);
        
        // Mark this scan in session storage to prevent repeated scans
        sessionStorage.setItem('auto_video_scan_timestamp', Date.now().toString());
        
      } catch (error) {
        console.error('[AutoVideoScan] Background scan failed:', error);
      } finally {
        setIsScanning(false);
      }
    };

    // Delay the scan slightly to not block initial page load
    const timeoutId = setTimeout(runBackgroundScan, 3000);
    
    return () => clearTimeout(timeoutId);
  }, [isAdmin, isUploader]);

  return {
    hasScanned,
    scanResult,
    isScanning,
  };
}
