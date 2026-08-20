// Timezone helpers for schedule day/time rendering + countdowns.

export const TIMEZONE_STORAGE_KEY = 'schedule_timezone';

export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getStoredTimeZone(): string {
  try {
    const saved = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (saved && isValidTimeZone(saved)) return saved;
  } catch {
    /* ignore */
  }
  return getSystemTimeZone();
}

export function storeTimeZone(tz: string) {
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, tz);
  } catch {
    /* ignore */
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Curated shortlist shown first in the picker. */
const COMMON_ZONES = [
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

export function getCommonTimeZones(): string[] {
  const sys = getSystemTimeZone();
  const list = COMMON_ZONES.filter(isValidTimeZone);
  return list.includes(sys) ? list : [sys, ...list];
}

export function getAllTimeZones(): string[] {
  try {
    const all = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
    if (all?.length) return all;
  } catch {
    /* ignore */
  }
  return getCommonTimeZones();
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock parts of an instant, as seen in the given timezone. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const hour = parseInt(get('hour'), 10);
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: hour === 24 ? 0 : hour,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    weekday: Math.max(0, WEEKDAYS.indexOf(get('weekday'))),
  };
}

function partsToUtcMs(p: ZonedParts) {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Offset (ms) of the timezone at the given instant. */
function tzOffsetMs(date: Date, timeZone: string) {
  return partsToUtcMs(getZonedParts(date, timeZone)) - date.getTime();
}

/** Build an instant from a wall-clock date/time expressed in `timeZone`. */
export function zonedWallClockToDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = new Date(guessMs - tzOffsetMs(new Date(guessMs), timeZone));
  // Second pass handles DST boundaries.
  result = new Date(guessMs - tzOffsetMs(result, timeZone));
  return result;
}

/** Add whole days to a zoned wall-clock date and return the resulting instant. */
export function nextZonedSlot(
  from: Date,
  addDays: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const p = getZonedParts(from, timeZone);
  // Normalise via UTC arithmetic on the wall-clock date, then convert back.
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day) + addDays * 86400000);
  return zonedWallClockToDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    hour,
    minute,
    timeZone,
  );
}

/** Short GMT label, e.g. "GMT+5:30". */
export function getTimeZoneLabel(timeZone: string, date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function formatTimeZoneName(tz: string): string {
  return tz.replace(/_/g, ' ');
}
