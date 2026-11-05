// Source-file size limits shared by the pre-write gate and the structure audit.
// SOFT warns (nudge to small files — token use + code-graph navigation, KIT-T087);
// HARD blocks (split the genuinely huge).
export const FILE_SOFT = 300;
export const FILE_HARD = 600;

// An already-oversized file may take an edit that shrinks it or adds at most this many net
// lines (a delegating call into a new file); larger growth stays blocked (KIT-T857).
export const OVERSIZED_NET_GROWTH_ALLOWED = 3;

// Verdict for a file going from `before` lines (0 when new) to `after` lines:
// 'block' | 'warn' | 'ok'.
export function fileLengthVerdict(before, after) {
  if (after > FILE_HARD) {
    const wasOversized = before > FILE_HARD;
    return wasOversized && after - before <= OVERSIZED_NET_GROWTH_ALLOWED ? 'warn' : 'block';
  }
  return after > FILE_SOFT ? 'warn' : 'ok';
}
