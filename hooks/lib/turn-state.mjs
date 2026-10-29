// Per-repo turn snapshot for the Stop "review queue GREW this turn" nag. SessionStart writes
// the current review count; Stop compares + rewrites it. Machine-local + disposable (the temp
// dir), keyed by a sanitized repo path so parallel projects don't collide. FAIL-OPEN: a read
// returns null (Stop then can't claim growth, so it stays silent — the safe direction); a write
// is best-effort. CLAUDE_KIT_TURN_STATE overrides the dir so the test harness can isolate it.
//
// `slot` partitions UNRELATED concerns into SEPARATE files (KIT-T021): housekeeping does a full
// overwrite (`writeTurnState(root, {review})`) at Stop, which would clobber any sibling key a
// later-running Stop hook stashed in the same object. A slot gives land-alert its own file so the
// two never race. The default slot keeps the original `<repo>.json` filename (back-compat for the
// existing review-count snapshot).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const stateDir = () => process.env.CLAUDE_KIT_TURN_STATE || join(tmpdir(), 'claude-kit-turnstate');
const repoKey = (root) => String(root).replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';

function turnStatePath(root, slot = '') {
  const key = repoKey(root);
  return join(stateDir(), slot ? `${key}.${slot}.json` : `${key}.json`);
}

/** Every slot of `root` whose name starts with `prefix`, as Map(slot -> state). Empty when none. */
export function readTurnSlots(root, prefix) {
  const head = `${repoKey(root)}.${prefix}`;
  const slots = new Map();
  try {
    for (const f of readdirSync(stateDir())) {
      if (!f.startsWith(head) || !f.endsWith('.json')) continue;
      const slot = f.slice(repoKey(root).length + 1, -'.json'.length);
      const state = readTurnState(root, slot);
      if (state) slots.set(slot, state);
    }
  } catch { /* no state dir yet */ }
  return slots;
}

export function readTurnState(root, slot = '') {
  try {
    return JSON.parse(readFileSync(turnStatePath(root, slot), 'utf8'));
  } catch {
    return null;
  }
}

export function clearTurnState(root, slot = '') {
  try {
    rmSync(turnStatePath(root, slot), { force: true });
  } catch {
    /* already gone */
  }
}

export function writeTurnState(root, state, slot = '') {
  try {
    const p = turnStatePath(root, slot);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(state) + '\n');
  } catch {
    /* turn state is best-effort — never break a hook */
  }
}
