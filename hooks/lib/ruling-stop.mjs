// ruling-stop — the Stop-hook half of the ruling rule (KIT-T938): a ruling captured this turn blocks once until it is
// promoted; a ruling from before this turn only warns, every Stop, until it leaves the inbox. In the framework's own store
// (KIT-T943) a ruling older than CONFIRMATION_DAYS blocks every Stop until it is triaged: framework directives rot unbuilt otherwise.
//   rulingStop(root, { turnStartMs, stopActive }) -> { block, warn }   block: text or '' (caller appends the triage footer); warn: text or ''
//   freshRulings(rulings, turnStartMs)            -> the rulings written this turn

import { unpromotedRulings } from './inbox-rulings.mjs';
import { stopBlock, staleWarning, overdueBlock } from './ruling-messages.mjs';
import { clearSighting, firstSighting } from '../block-once.mjs';
import { isFrameworkStore } from './framework-scope.mjs';
import { CONFIRMATION_DAYS } from '../../scripts/q-inbox.mjs';

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
  const freshBlock = fresh.length && !stopActive && firstSighting(scope, fresh.map((r) => r.id).join(',')) ? stopBlock(fresh) : '';
  const overdue = !stopActive && isFrameworkStore(root) ? old.filter((r) => r.days !== null && r.days >= CONFIRMATION_DAYS) : [];
  const resting = old.filter((r) => !overdue.includes(r));
  return { block: [freshBlock, overdue.length ? overdueBlock(overdue, CONFIRMATION_DAYS) : ''].filter(Boolean).join('\n'), warn: resting.length ? staleWarning(resting) : '' };
}
