import { ReactNode } from 'react';

/**
 * Page transition wrapper.
 *
 * Previously used framer-motion to fade/slide each route. That fired on every
 * navigation and caused noticeable jank on iOS/iPad (re-mount + transform
 * on the entire page tree). For stable 60fps we render children directly.
 * The previous opacity flash also caused content to briefly disappear.
 */
export function AnimatedPage({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
