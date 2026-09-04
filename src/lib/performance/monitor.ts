/**
 * Development-only performance monitor.
 *
 * Logs long tasks (>50ms blocks of the main thread) and layout shifts to the
 * console so regressions are visible while building. It is never registered
 * in production builds and never sends data anywhere.
 */

let installed = false;

export function installPerfMonitor(): () => void {
  if (installed || typeof PerformanceObserver === 'undefined') return () => {};
  installed = true;

  const observers: PerformanceObserver[] = [];

  const observe = (type: string, handler: (entry: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(handler);
      });
      observer.observe({ type, buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Entry type unsupported in this browser — skip it silently.
    }
  };

  observe('longtask', (entry) => {
    if (entry.duration < 80) return;
    console.warn(
      `[perf] long task ${Math.round(entry.duration)}ms — the UI could not respond during this window`
    );
  });

  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (shift.hadRecentInput || shift.value < 0.05) return;
    console.warn(`[perf] layout shift ${shift.value.toFixed(3)}`);
  });

  return () => {
    observers.forEach((o) => o.disconnect());
    installed = false;
  };
}
