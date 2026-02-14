import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that automatically scans for unconverted videos AND auto-starts
 * pending conversions on app startup. Runs continuously in background
 * for admin/uploader users. Only stops when the browser/tab is closed.
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start pending conversions
  const autoStartPending = async () => {
    try {
      const { data: pending } = await supabase
        .from('video_conversions')
        .select('id')
        .eq('status', 'pending')
        .eq('needs_conversion', true)
        .limit(10);

      if (pending && pending.length > 0) {
        const ids = pending.map(p => p.id);
        const { error } = await supabase
          .from('video_conversions')
          .update({
            status: 'processing',
            conversion_started_at: new Date().toISOString(),
            error_message: null,
          })
          .in('id', ids);

        if (!error) {
          console.log(`[AutoVideoScan] Auto-started ${ids.length} pending conversions`);
        }
      }
    } catch (error) {
      console.error('[AutoVideoScan] Auto-start failed:', error);
    }
  };

  useEffect(() => {
    // Only run for admins or uploaders
    if (!isAdmin && !isUploader) return;
    
    // Prevent multiple scan attempts in the same session
    if (scanAttemptedRef.current) return;

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
        
        // Auto-start any pending conversions immediately
        await autoStartPending();
        
      } catch (error) {
        console.error('[AutoVideoScan] Background scan failed:', error);
      } finally {
        setIsScanning(false);
      }
    };

    // Delay the initial scan slightly to not block page load
    const timeoutId = setTimeout(runBackgroundScan, 3000);

    // Keep checking for pending conversions every 60 seconds
    // This ensures the converter never stops unless the browser is closed
    intervalRef.current = setInterval(autoStartPending, 60000);
    
    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAdmin, isUploader]);

  return {
    hasScanned,
    scanResult,
    isScanning,
  };
}
