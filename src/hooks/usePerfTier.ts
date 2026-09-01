import { useEffect, useRef, useState } from 'react';
import {
  getPerfTier,
  subscribePerfTier,
  type PerfTier,
} from '@/lib/performance/deviceTier';

/** Reactive access to the resolved device performance tier. */
export function usePerfTier(): PerfTier {
  const [tier, setTier] = useState<PerfTier>(() => getPerfTier());
  useEffect(() => subscribePerfTier(setTier), []);
  return tier;
}

/** Convenience: true when decorative continuous effects should be skipped. */
export function useLightEffects(): boolean {
  return usePerfTier() !== 'high';
}

/**
 * True only while the tab is visible. Use it to gate intervals, autoplay
 * rotation and any other work that is pointless in a background tab.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible'
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * Tracks whether an element is inside (or near) the viewport.
 * Used to pause off-screen carousels and defer off-screen work.
 */
export function useInViewport<T extends Element>(
  options?: { rootMargin?: string; once?: boolean }
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((e) => e.isIntersecting);
        setInView(isVisible);
        if (isVisible && options?.once) observer.disconnect();
      },
      { rootMargin: options?.rootMargin ?? '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.rootMargin, options?.once]);

  return [ref, inView];
}

/** Visible tab AND on-screen element — the correct gate for animation loops. */
export function useActiveOnScreen<T extends Element>(
  rootMargin = '150px'
): [React.RefObject<T>, boolean] {
  const [ref, inView] = useInViewport<T>({ rootMargin });
  const pageVisible = usePageVisible();
  return [ref, inView && pageVisible];
}
