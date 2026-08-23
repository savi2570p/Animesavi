import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { friendlyMessage } from '@/lib/errors/logger';
import { RefreshCw } from 'lucide-react';

interface SectionBoundaryProps {
  children: ReactNode;
  /** Section name used for logging only (never shown to users). */
  label: string;
  /** Hide the whole section on crash instead of showing a fallback card. */
  silent?: boolean;
  resetKeys?: unknown[];
}

/**
 * Wraps a home/page section so one failing row can never take down the page.
 * Matches the app's liquid-glass styling.
 */
export function SectionBoundary({ children, label, silent, resetKeys }: SectionBoundaryProps) {
  return (
    <ErrorBoundary
      label={label}
      silent={silent}
      resetKeys={resetKeys}
      fallback={(error, reset) => (
        <section className="container py-6" role="alert" aria-live="polite">
          <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-muted-foreground">{friendlyMessage(error)}</p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/70"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload section
            </button>
          </div>
        </section>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
