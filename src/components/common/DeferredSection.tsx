import { ReactNode, useEffect, useRef, useState } from 'react';

interface DeferredSectionProps {
  children: ReactNode;
  /** Reserved height before mount so deferring never causes layout shift. */
  minHeight?: number;
  /** How far ahead of the viewport to mount. */
  rootMargin?: string;
  /** Optional placeholder rendered while the section is not yet mounted. */
  placeholder?: ReactNode;
}

/**
 * Mounts its children only once they approach the viewport.
 *
 * The home page previously mounted ~15 data-fetching rows at once, firing a
 * burst of parallel queries and a large synchronous render on the very first
 * frame. Deferring the below-the-fold rows keeps the first paint cheap while
 * still loading each row well before the user scrolls to it.
 */
export function DeferredSection({
  children,
  minHeight = 260,
  rootMargin = '400px',
  placeholder,
}: DeferredSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browsers) — render immediately rather
    // than hiding content.
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={ref} style={mounted ? undefined : { minHeight }} aria-busy={!mounted}>
      {mounted ? children : placeholder ?? null}
    </div>
  );
}
