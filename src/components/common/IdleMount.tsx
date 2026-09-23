import { ReactNode, useEffect, useState } from 'react';

interface IdleMountProps {
  children: ReactNode;
  /** Hard ceiling (ms) after which children mount even if the browser stays busy. */
  timeout?: number;
}

/**
 * Defers mounting non-critical global overlays/initializers until the browser is
 * idle (or the timeout elapses). Keeps first paint and hydration work small so
 * the first screen appears faster on iOS, Android and desktop.
 */
export function IdleMount({ children, timeout = 2000 }: IdleMountProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    }).requestIdleCallback;

    let idleId: number | undefined;
    let timerId: number | undefined;

    if (typeof ric === 'function') {
      idleId = ric(mount, { timeout });
    } else {
      timerId = window.setTimeout(mount, 600);
    }

    return () => {
      cancelled = true;
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idleId !== undefined && typeof cic === 'function') cic(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [timeout]);

  if (!ready) return null;
  return <>{children}</>;
}
