import { Component, ErrorInfo, ReactNode } from 'react';
import { logError, friendlyMessage } from '@/lib/errors/logger';

interface Props {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (error: unknown, reset: () => void) => ReactNode;
  /** Render nothing at all when this subtree crashes (for optional widgets). */
  silent?: boolean;
  /** Changing any value in this array resets the boundary (e.g. route key). */
  resetKeys?: unknown[];
  onError?: (error: unknown) => void;
  label?: string;
}

interface State {
  error: unknown | null;
}

/**
 * Generic crash isolator. A failure inside `children` never blanks the app —
 * only this subtree is replaced by the fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('boundary', error, { label: this.props.label, componentStack: info.componentStack });
    this.props.onError?.(error);
  }

  componentDidUpdate(prev: Props) {
    const a = prev.resetKeys;
    const b = this.props.resetKeys;
    if (!this.state.error || !a || !b) return;
    if (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.silent) return null;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-6 text-center"
      >
        <p className="text-sm text-muted-foreground">{friendlyMessage(error)}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-lg border border-border/60 bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background/70"
        >
          Try again
        </button>
      </div>
    );
  }
}
