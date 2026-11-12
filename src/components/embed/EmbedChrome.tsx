import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, Check, FastForward, Play, Rewind, ShieldAlert, X } from 'lucide-react';
import logo from '@/assets/logo.png';
import { PlayerSpinner } from '@/components/video/PlayerSpinner';
import { cn } from '@/lib/utils';
import '@/styles/embed-player.css';

/**
 * Shared presentation pieces for every embed player (Embed Player v3).
 * Pure UI: each player keeps its own playback state, sources and handlers.
 */

export function formatEmbedTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function EmbedBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn('ep3-brand', compact && 'is-compact')} aria-label="AnimeSavi+">
      <img src={logo} alt="" draggable={false} />
      <span>AnimeSavi<b>+</b></span>
    </span>
  );
}

type StatusTone = 'loading' | 'error' | 'blocked';

export function EmbedStatus({
  tone,
  title,
  message,
  progress,
  brand = true,
  variant = 'screen',
  children,
}: {
  tone: StatusTone;
  title?: string;
  message?: ReactNode;
  progress?: number;
  brand?: boolean;
  /** screen = full viewport, overlay = covers the player, inline = 16:9 box */
  variant?: 'screen' | 'overlay' | 'inline';
  children?: ReactNode;
}) {
  return (
    <div
      className={cn('ep3 ep3-status', variant === 'overlay' && 'is-overlay', variant === 'inline' && 'is-inline')}
      role={tone === 'loading' ? 'status' : 'alert'}
      aria-label={tone === 'loading' && !title ? 'Loading video' : undefined}
    >
      <div className="ep3-status-card">
        {brand && <EmbedBrand />}
        <div className="ep3-status-icon" data-tone={tone}>
          {tone === 'loading' ? <PlayerSpinner /> : tone === 'blocked' ? <ShieldAlert /> : <AlertTriangle />}
        </div>
        {title && <h2>{title}</h2>}
        {message && <p>{message}</p>}
        {typeof progress === 'number' && (
          <div className="ep3-progress" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
        )}
        {children && <div className="ep3-actions">{children}</div>}
      </div>
    </div>
  );
}

export function EmbedSeek({
  value,
  max = 100,
  buffered = 0,
  step,
  onChange,
}: {
  value: number;
  max?: number;
  /** Buffered amount as a 0-100 percentage. */
  buffered?: number;
  step?: number | 'any';
  onChange: (value: number) => void;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax || 0) : 0;
  const pct = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;
  const style = { '--ep3-p': `${pct}%`, '--ep3-b': `${Math.max(0, Math.min(100, buffered || 0))}%` } as CSSProperties;
  return (
    <div className="ep3-seek" style={style} onClick={(e) => e.stopPropagation()}>
      <span className="ep3-seek-track" />
      <span className="ep3-seek-buffer" />
      <span className="ep3-seek-fill" />
      <span className="ep3-seek-thumb" />
      <input
        type="range"
        min={0}
        max={safeMax}
        step={step ?? 'any'}
        value={safeValue}
        aria-label="Seek"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function EmbedTime({ current, duration }: { current: number; duration: number }) {
  return (
    <span className="ep3-time">
      {formatEmbedTime(current)}<i>/</i><em>{formatEmbedTime(duration)}</em>
    </span>
  );
}

export function EmbedBtn({
  label,
  onClick,
  active,
  primary,
  children,
  className,
}: {
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  primary?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn('ep3-btn', primary && 'is-primary', className)}
      aria-label={label}
      title={label}
      data-active={active ? 'true' : undefined}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EmbedMenu({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="ep3-menu" role="menu" aria-label={label} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function EmbedMenuLabel({ children }: { children: ReactNode }) {
  return <div className="ep3-menu-label">{children}</div>;
}

export function EmbedMenuItem({
  active,
  onClick,
  disabled,
  children,
  hint,
}: {
  active?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={!!active}
      className="ep3-menu-item"
      data-active={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span>{children}</span>
      {active ? <Check /> : hint ? <small>{hint}</small> : null}
    </button>
  );
}

export function EmbedCenterPlay({ onClick }: { onClick: () => void }) {
  return (
    <div className="ep3-center">
      <button
        type="button"
        className="ep3-center-play"
        aria-label="Play"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Play />
      </button>
    </div>
  );
}

export function EmbedLoading({ label, title }: { label?: string; title?: string }) {
  return (
    <div className="ep3-loading" aria-live="polite">
      <PlayerSpinner />
      {title && <span className="ep3-loading-title">{title}</span>}
      {label && <span className="ep3-loading-text">{label}</span>}
    </div>
  );
}

export function EmbedDoubleTap({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={cn('ep3-tap', side === 'left' ? 'is-left' : 'is-right')} aria-hidden>
      {side === 'left' ? <><Rewind />10s</> : <>10s<FastForward /></>}
    </div>
  );
}

export interface EmbedEpisodeItem {
  key: string;
  number: number;
  title?: string | null;
  active?: boolean;
  seasonNumber?: number;
}

export function EmbedEpisodeDrawer({
  heading,
  subheading,
  items,
  seasons,
  activeSeason,
  onSeasonChange,
  onSelect,
  onClose,
}: {
  heading: string;
  subheading?: string;
  items: EmbedEpisodeItem[];
  seasons?: number[];
  activeSeason?: number;
  onSeasonChange?: (season: number) => void;
  onSelect: (item: EmbedEpisodeItem) => void;
  onClose: () => void;
}) {
  return (
    // `controls-area` keeps legacy "tap video to toggle play" handlers from firing here.
    <div className="controls-area ep3-drawer-wrap" onClick={(e) => e.stopPropagation()}>
      <div className="ep3-drawer-backdrop" onClick={onClose} />
      <aside className="ep3-drawer" role="dialog" aria-label="Episodes">
        <div className="ep3-drawer-head">
          <div>
            <h3>{heading}</h3>
            {subheading && <p>{subheading}</p>}
          </div>
          <button type="button" className="ep3-btn" aria-label="Close episodes" onClick={onClose}>
            <X />
          </button>
        </div>
        {seasons && seasons.length > 1 && (
          <div className="ep3-seasons">
            {seasons.map((s) => (
              <button
                key={s}
                type="button"
                data-active={s === activeSeason ? 'true' : undefined}
                onClick={() => onSeasonChange?.(s)}
              >
                Season {s}
              </button>
            ))}
          </div>
        )}
        <div className="ep3-ep-list">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ep3-ep"
              data-active={item.active ? 'true' : undefined}
              aria-current={item.active ? 'true' : undefined}
              onClick={() => onSelect(item)}
            >
              <span className="ep3-ep-num">{item.number}</span>
              <span className="ep3-ep-text">
                <strong>{item.title || `Episode ${item.number}`}</strong>
                <span>
                  {item.active
                    ? 'Now playing'
                    : `${item.seasonNumber != null ? `S${item.seasonNumber} · ` : ''}Episode ${item.number}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
