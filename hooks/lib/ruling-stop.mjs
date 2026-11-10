// ruling-stop — the Stop-hook half of the ruling rule (KIT-T938): a ruling captured this turn blocks once until it is
// promoted; a ruling from before this turn only warns, every Stop, until it leaves the inbox.
//   rulingStop(root, { turnStartMs, stopActive }) -> { block, warn }   block: text or '' (caller appends the triage footer); warn: text or ''
//   freshRulings(rulings, turnStartMs)            -> the rulings written this turn

import { unpromotedRulings } from './inbox-rulings.mjs';
import { stopBlock, staleWarning } from './ruling-messages.mjs';
import { clearSighting, firstSighting } from '../block-once.mjs';

const SKEW_MS = 1500;
const STAMP_GRANULARITY_MS = 60000;

// mtime moves on a git pull, the filename stamp does not; a note is fresh only when both say this turn.
export function freshRulings(rulings, turnStartMs) {
  if (!turnStartMs) return [];
  return rulings.filter((r) => r.writtenMs >= turnStartMs - SKEW_MS && (Number.isNaN(r.capturedMs) || r.capturedMs >= turnStartMs - STAMP_GRANULARITY_MS));
}

export function rulingStop(root, { turnStartMs = 0, stopActive = false } = {}) {
  const rulings = unpromotedRulings(root);
  const scope = `rulings:${root}`;
  const fresh = freshRulings(rulings, turnStartMs);
  const old = rulings.filter((r) => !fresh.includes(r));
  if (!fresh.length) clearSighting(scope);
  const block = fresh.length && !stopActive && firstSighting(scope, fresh.map((r) => r.id).join(',')) ? stopBlock(fresh) : '';
  return { block, warn: old.length ? staleWarning(old) : '' };
}
