import { cn } from '@/lib/utils';

/**
 * Shared transparent player spinner: a slim lime arc with a faint track and
 * no background, so the video frame stays fully visible behind it.
 */
export function PlayerSpinner({ tone = 'primary', className }: { tone?: 'primary' | 'warn'; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('player-spinner', tone === 'warn' && 'is-warn', className)} aria-hidden="true">
      <circle cx="24" cy="24" r="20" className="player-spinner-track" />
      <circle cx="24" cy="24" r="20" className="player-spinner-arc" />
    </svg>
  );
}
