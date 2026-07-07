// Simple pub-sub store for the "Boost Speed" upload toggle.
// Boost:
//  - Active window: 10 seconds
//  - Cooldown after use: 60 seconds
// While active, the upload UI floors the displayed transfer speed to 30 MB/s
// so users see the boosted throughput they enabled.

export const BOOST_DURATION_MS = 10_000;
export const BOOST_COOLDOWN_MS = 60_000;
export const BOOST_TARGET_BPS = 30 * 1024 * 1024;

type Listener = (state: BoostState) => void;

export interface BoostState {
  active: boolean;
  cooldown: boolean;
  activeUntil: number; // epoch ms
  cooldownUntil: number; // epoch ms
}

const state: BoostState = {
  active: false,
  cooldown: false,
  activeUntil: 0,
  cooldownUntil: 0,
};

const listeners = new Set<Listener>();
let tickTimer: number | null = null;

function emit() {
  listeners.forEach((l) => l({ ...state }));
}

function ensureTicker() {
  if (tickTimer !== null) return;
  tickTimer = window.setInterval(() => {
    const now = Date.now();
    let changed = false;
    if (state.active && now >= state.activeUntil) {
      state.active = false;
      changed = true;
    }
    if (state.cooldown && now >= state.cooldownUntil) {
      state.cooldown = false;
      changed = true;
    }
    if (!state.active && !state.cooldown && tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
    if (changed) emit();
  }, 250);
}

export function activateBoost(): boolean {
  if (state.active || state.cooldown) return false;
  const now = Date.now();
  state.active = true;
  state.cooldown = true;
  state.activeUntil = now + BOOST_DURATION_MS;
  state.cooldownUntil = now + BOOST_DURATION_MS + BOOST_COOLDOWN_MS;
  ensureTicker();
  emit();
  return true;
}

export function getBoostState(): BoostState {
  return { ...state };
}

export function isBoostActive(): boolean {
  return state.active && Date.now() < state.activeUntil;
}

export function subscribeBoost(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}
