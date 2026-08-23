import { useCallback, useEffect, useRef, useState } from 'react';
import { logError, ErrorScope } from '@/lib/errors/logger';

/**
 * Returns a guard that tells you whether the component is still mounted.
 * Prevents "setState on unmounted component" leaks after slow requests.
 */
export function useIsMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}

/**
 * Race-condition protection for rapidly re-issued requests.
 * Only the newest call's result is accepted; older ones are dropped and
 * their AbortController is aborted.
 */
export function useLatestRequest() {
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(() => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    const id = ++seq.current;
    return {
      signal: ac.signal,
      /** True when this request is still the most recent one. */
      isCurrent: () => id === seq.current,
    };
  }, []);

  return start;
}

interface AsyncActionOptions {
  scope?: ErrorScope;
  onError?: (error: unknown) => void;
}

/**
 * Wraps an async action (button submit, save, delete) so it can never be
 * fired twice concurrently and always resets its pending state.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: AsyncActionOptions = {}
) {
  const { scope = 'unknown', onError } = options;
  const [isPending, setIsPending] = useState(false);
  const inFlight = useRef(false);
  const isMounted = useIsMounted();

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setIsPending(true);
      try {
        return await action(...args);
      } catch (error) {
        logError(scope, error);
        onError?.(error);
        return undefined;
      } finally {
        inFlight.current = false;
        if (isMounted()) setIsPending(false);
      }
    },
    [action, scope, onError, isMounted]
  );

  return { run, isPending };
}
