import { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

/**
 * Player theme system — session-only.
 * Each theme overrides --primary (and friends) on the player container,
 * so existing `text-primary` / `bg-primary` accents recolor automatically.
 */
export type PlayerThemeKey =
  | 'classic'
  | 'midnight'
  | 'sunset'
  | 'mono'
  | 'crimson'
  | 'emerald'
  | 'ocean'
  | 'rose'
  | 'fuchsia'
  | 'lime'
  | 'gold'
  | 'cyan';

export interface PlayerTheme {
  key: PlayerThemeKey;
  name: string;
  swatch: string; // gradient preview
  // CSS vars applied to the player container (HSL triples, no hsl() wrapper)
  vars: {
    '--primary': string;
    '--primary-foreground': string;
    '--player-accent-glow': string; // rgba for shadows
  };
}

export const PLAYER_THEMES: PlayerTheme[] = [
  {
    key: 'classic',
    name: 'Royal Purple',
    swatch: 'linear-gradient(135deg, hsl(270 75% 55%), hsl(280 70% 40%))',
    vars: { '--primary': '270 75% 55%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(168, 85, 247, 0.55)' },
  },
  {
    key: 'crimson',
    name: 'Crimson Red',
    swatch: 'linear-gradient(135deg, hsl(0 85% 55%), hsl(350 75% 40%))',
    vars: { '--primary': '0 85% 55%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(239, 68, 68, 0.55)' },
  },
  {
    key: 'midnight',
    name: 'Midnight Blue',
    swatch: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(222 60% 30%))',
    vars: { '--primary': '217 91% 60%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(59, 130, 246, 0.55)' },
  },
  {
    key: 'ocean',
    name: 'Ocean Teal',
    swatch: 'linear-gradient(135deg, hsl(190 85% 50%), hsl(200 75% 35%))',
    vars: { '--primary': '190 85% 50%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(20, 184, 166, 0.55)' },
  },
  {
    key: 'cyan',
    name: 'Electric Cyan',
    swatch: 'linear-gradient(135deg, hsl(180 90% 55%), hsl(195 85% 45%))',
    vars: { '--primary': '180 90% 55%', '--primary-foreground': '200 30% 8%', '--player-accent-glow': 'rgba(6, 182, 212, 0.55)' },
  },
  {
    key: 'emerald',
    name: 'Emerald Green',
    swatch: 'linear-gradient(135deg, hsl(155 75% 45%), hsl(160 70% 30%))',
    vars: { '--primary': '155 75% 45%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(16, 185, 129, 0.55)' },
  },
  {
    key: 'lime',
    name: 'Neon Lime',
    swatch: 'linear-gradient(135deg, hsl(80 85% 55%), hsl(95 75% 40%))',
    vars: { '--primary': '80 85% 55%', '--primary-foreground': '90 30% 10%', '--player-accent-glow': 'rgba(132, 204, 22, 0.55)' },
  },
  {
    key: 'sunset',
    name: 'Sunset Amber',
    swatch: 'linear-gradient(135deg, hsl(38 92% 55%), hsl(20 88% 48%))',
    vars: { '--primary': '32 95% 55%', '--primary-foreground': '24 30% 10%', '--player-accent-glow': 'rgba(245, 158, 11, 0.55)' },
  },
  {
    key: 'gold',
    name: 'Royal Gold',
    swatch: 'linear-gradient(135deg, hsl(45 95% 55%), hsl(38 90% 45%))',
    vars: { '--primary': '45 95% 55%', '--primary-foreground': '38 40% 12%', '--player-accent-glow': 'rgba(234, 179, 8, 0.55)' },
  },
  {
    key: 'rose',
    name: 'Rose Pink',
    swatch: 'linear-gradient(135deg, hsl(340 85% 60%), hsl(330 75% 45%))',
    vars: { '--primary': '340 85% 60%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(244, 114, 182, 0.55)' },
  },
  {
    key: 'fuchsia',
    name: 'Vivid Fuchsia',
    swatch: 'linear-gradient(135deg, hsl(295 85% 60%), hsl(310 80% 45%))',
    vars: { '--primary': '295 85% 60%', '--primary-foreground': '0 0% 100%', '--player-accent-glow': 'rgba(217, 70, 239, 0.55)' },
  },
  {
    key: 'mono',
    name: 'Minimal Mono',
    swatch: 'linear-gradient(135deg, hsl(0 0% 95%), hsl(0 0% 50%))',
    vars: { '--primary': '0 0% 96%', '--primary-foreground': '0 0% 8%', '--player-accent-glow': 'rgba(255, 255, 255, 0.45)' },
  },
];

/** Build the inline style object to spread onto the player container. */
export function buildThemeStyle(theme: PlayerThemeKey): React.CSSProperties {
  const t = PLAYER_THEMES.find((x) => x.key === theme) ?? PLAYER_THEMES[0];
  return t.vars as unknown as React.CSSProperties;
}

interface ThemePickerButtonProps {
  value: PlayerThemeKey;
  onChange: (key: PlayerThemeKey) => void;
  iconClassName?: string;
  containerEl?: HTMLElement | null;
}

/**
 * Compact palette button + popover. Drop next to the Settings button.
 * Flat / minimal — matches X-PLUS style: no circular background.
 */
export function ThemePickerButton({
  value,
  onChange,
  iconClassName = 'w-5 h-5 md:w-6 md:h-6',
  containerEl,
}: ThemePickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-white hover:text-white/80 transition-colors"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((p) => !p);
          }}
          title="Player theme"
          style={{ touchAction: 'manipulation' }}
        >
          <Palette className={iconClassName} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={12}
        collisionPadding={12}
        avoidCollisions
        className="bg-background/95 backdrop-blur-xl border-border/50 w-[240px] max-h-[60vh] overflow-y-auto p-2"
        style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={() => setOpen(false)}
        container={containerEl || undefined}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2 px-1 pb-2">
          <Palette className="w-3.5 h-3.5" />
          Player Theme · {PLAYER_THEMES.length}
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1">
          {PLAYER_THEMES.map((t) => {
            const active = t.key === value;
            return (
              <button
                key={t.key}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(t.key);
                  setOpen(false);
                }}
                className={`flex flex-col items-center gap-1.5 w-full rounded-md px-1.5 py-2 text-center hover:bg-accent transition-colors ${
                  active ? 'bg-accent/60 ring-1 ring-primary/50' : ''
                }`}
                title={t.name}
              >
                <span
                  aria-hidden
                  className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white/15 relative"
                  style={{ background: t.swatch }}
                >
                  {active && (
                    <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />
                  )}
                </span>
                <span className="text-[10px] font-medium text-foreground leading-tight line-clamp-1">{t.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[10px] text-muted-foreground/70">
          Session only — resets when you close this tab.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
