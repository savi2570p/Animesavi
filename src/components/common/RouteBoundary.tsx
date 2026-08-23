import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { friendlyMessage } from '@/lib/errors/logger';
import { RefreshCw, Home } from 'lucide-react';

/**
 * Route-level crash isolation: a page-level error shows a recoverable screen
 * instead of a white page, and automatically clears on navigation.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      label={`route:${location.pathname}`}
      resetKeys={[location.pathname]}
      fallback={(error, reset) => (
        <main
          role="alert"
          aria-live="assertive"
          className="min-h-[70vh] flex items-center justify-center px-4"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="w-full max-w-md rounded-3xl border border-border/40 bg-card/40 backdrop-blur-2xl p-8 text-center shadow-2xl">
            <h1 className="text-lg font-semibold text-foreground">This page hit a snag</h1>
            <p className="mt-2 text-sm text-muted-foreground">{friendlyMessage(error)}</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  navigate('/');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background/70"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Go home
              </button>
            </div>
          </div>
        </main>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
