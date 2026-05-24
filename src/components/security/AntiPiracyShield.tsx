import { useEffect, useState } from 'react';
import { installAntiPiracy, subscribeRecordingLock, type AntiPiracyMode } from '@/lib/antiPiracy';
import { SecurityOverlay } from './SecurityOverlay';

interface AntiPiracyShieldProps {
  mode?: AntiPiracyMode;
  /** If true, suppress the home redirect (used inside Flox so the overlay can stay visible). */
  noRedirect?: boolean;
  children?: React.ReactNode;
}

/**
 * Mounts the anti-piracy guard once and renders the fullscreen recording-lock
 * overlay whenever screen capture is detected — regardless of mode.
 */
export function AntiPiracyShield({ mode = 'soft', noRedirect, children }: AntiPiracyShieldProps) {
  const [devtoolsTrip, setDevtoolsTrip] = useState(false);
  const [recordingLocked, setRecordingLocked] = useState(false);

  useEffect(() => {
    const uninstall = installAntiPiracy({
      mode,
      redirectOnTrip: !noRedirect,
      onTrip: (reason) => {
        if (reason === 'devtools') setDevtoolsTrip(true);
      },
    });
    const unsub = subscribeRecordingLock((locked) => setRecordingLocked(locked));
    return () => { uninstall(); unsub(); };
  }, [mode, noRedirect]);

  // While locked, defensively re-kill any <video> that tries to start.
  useEffect(() => {
    if (!recordingLocked) return;
    const interval = window.setInterval(() => {
      document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => {
        try {
          if (!v.paused) v.pause();
          if (v.src) v.removeAttribute('src');
          v.style.filter = 'blur(40px)';
        } catch {}
      });
    }, 250);
    return () => {
      window.clearInterval(interval);
      document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => {
        try { v.style.filter = ''; } catch {}
      });
    };
  }, [recordingLocked]);

  const showRecording = recordingLocked;
  const showDevtools = !recordingLocked && mode === 'strict' && devtoolsTrip;

  return (
    <>
      {children}
      <SecurityOverlay
        visible={showRecording}
        message="Screen Recording Detected"
        subtitle="Please Stop Screen Recording To Continue Watching"
        unclosable
      />
      <SecurityOverlay
        visible={showDevtools}
        message="Inspection Blocked"
        subtitle="Close developer tools to resume playback."
        unclosable={false}
      />
    </>
  );
}
