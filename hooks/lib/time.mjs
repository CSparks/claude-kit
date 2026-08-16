// Date/age primitives shared by the closure scanners and reminders. Every one is
// FAIL-OPEN: an unreadable path or unparseable date yields null, never a throw.

import { statSync } from 'node:fs';

export const MS_PER_DAY = 86400000;

// Age in whole days of a path by mtime; null when it can't be stat'd.
export function ageDays(path) {
  try {
    return Math.floor((Date.now() - statSync(path).mtimeMs) / MS_PER_DAY);
  } catch {
    return null;
  }
}

// A date-only ISO string (YYYY-MM-DD, leading field of any ISO timestamp) → whole UTC days since
// the epoch, or null when absent/unparseable. Date.parse of a bare YYYY-MM-DD is UTC midnight, so
// the floor is a stable calendar-day number that ignores clock time and timezone.
export function utcDay(dateStr) {
  if (!dateStr) return null;
  const ms = Date.parse(String(dateStr).trim().slice(0, 10));
  return Number.isFinite(ms) ? Math.floor(ms / MS_PER_DAY) : null;
}
