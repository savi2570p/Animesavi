import { useEffect, useState } from 'react';
import { installAntiPiracy, type AntiPiracyMode } from '@/lib/antiPiracy';
import { SecurityOverlay } from './SecurityOverlay';

interface AntiPiracyShieldProps {
  mode?: AntiPiracyMode;
  /** If true, suppress the home redirect (used inside Flox so the overlay can stay visible). */
  noRedirect?: boolean;
  children?: React.ReactNode;
}

/**
 * Wraps a subtree with the anti-piracy layer. Mount once near the app root
 * for soft mode, and use again with `mode="strict"` around the Flox player.
 */
export function AntiPiracyShield({ mode = 'soft', noRedirect, children }: AntiPiracyShieldProps) {
  const [tripReason, setTripReason] = useState<string | null>(null);

  useEffect(() => {
    const uninstall = installAntiPiracy({
      mode,
      redirectOnTrip: !noRedirect,
      onTrip: (reason) => {
        if (reason === 'devtools' || reason === 'screenshare') {
          setTripReason(reason);
        }
      },
    });
    return uninstall;
  }, [mode, noRedirect]);

  return (
    <>
      {children}
      <SecurityOverlay
        visible={mode === 'strict' && tripReason !== null}
        message={tripReason === 'screenshare' ? 'Stop screen recording to continue watching' : 'Inspection blocked'}
        subtitle={
          tripReason === 'screenshare'
            ? 'Screen capture is not permitted while watching premium content.'
            : 'Close developer tools to resume playback.'
        }
      />
    </>
  );
}
