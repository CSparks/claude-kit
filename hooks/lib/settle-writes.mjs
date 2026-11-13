// Waits for another writer's lagging confirmation before a shell call is blamed for a file (hand-write-detect, KIT-T1010).
// An Edit or Write is known twice: pre-write records the content it will leave before the tool runs, and the PostToolUse
// recorder confirms it after, which can lag by seconds under load. A shell call that began between the two and a file
// landing inside it holds a matching prediction but no confirmation yet; the call is not blamed until the confirmation
// has had `maxMs` to arrive. A prediction nothing confirms (a session without the recorder) still owns nothing.
//
//   hasPendingPrediction(root, rel, hash, caller, sinceMs) -> true when another writer's unconfirmed prediction of `hash`
//     for `rel` was made no more than PREDICTION_LEAD_MS before `sinceMs`, or since
//   settleOwned(rels, { pending, proven, maxMs, pollMs }) -> `rels` minus every file `proven` once no remaining file is
//     `pending` or `maxMs` ran out
//   settleMsFromEnv() -> maxMs from CLAUDE_KIT_WRITE_SETTLE_MS, default WRITE_SETTLE_MS

import { toolWriteEntries } from './tool-write-ledger.mjs';

export const WRITE_SETTLE_MS = 30000;
export const SETTLE_POLL_MS = 100;
const PREDICTION_LEAD_MS = 30000;

export const settleMsFromEnv = () => {
  const raw = process.env.CLAUDE_KIT_WRITE_SETTLE_MS;
  const ms = raw === undefined || raw === '' ? NaN : Number(raw);
  return ms >= 0 ? ms : WRITE_SETTLE_MS;
};

export function hasPendingPrediction(root, rel, hash, caller, sinceMs) {
  return Boolean(hash) && toolWriteEntries(root, rel).some((e) => e.h === hash && e.c !== true
    && e.w !== caller && (e.ts || 0) >= sinceMs - PREDICTION_LEAD_MS);
}

export async function settleOwned(rels, { pending, proven, maxMs = WRITE_SETTLE_MS, pollMs = SETTLE_POLL_MS }) {
  const end = Date.now() + maxMs;
  let owned = rels.filter((rel) => !proven(rel));
  while (owned.some(pending) && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    owned = owned.filter((rel) => !proven(rel));
  }
  return owned;
}
