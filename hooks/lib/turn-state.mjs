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

import { appendFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const stateDir = () => process.env.CLAUDE_KIT_TURN_STATE || join(tmpdir(), 'claude-kit-turnstate');
const repoKey = (root) => String(root).replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';

function turnStatePath(root, slot = '') {
  const key = repoKey(root);
  return join(stateDir(), slot ? `${key}.${slot}.json` : `${key}.json`);
}

// A RECORD slot is an append-only JSON-lines file: concurrent writers each add a line and none rewrites another's, which a
// read-modify-write state file cannot promise (KIT-T1133). Used where several writers of one session record at once.
const recordsPath = (root, slot) => join(stateDir(), `${repoKey(root)}.${slot}.jsonl`);

export function appendTurnRecord(root, slot, record) {
  try {
    const p = recordsPath(root, slot);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, `${JSON.stringify(record)}\n`);
  } catch {
    /* turn state is best-effort — never break a hook */
  }
}

/** The records of a RECORD slot, oldest first; a torn or unreadable line is skipped. */
export function readTurnRecords(root, slot) {
  let text = '';
  try { text = readFileSync(recordsPath(root, slot), 'utf8'); } catch { return []; }
  return text.split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

/** Every slot name of `root` starting with `prefix`, state files and record files alike. */
export function turnSlotNames(root, prefix) {
  const head = `${repoKey(root)}.${prefix}`;
  try {
    const names = readdirSync(stateDir()).filter((f) => f.startsWith(head)).map((f) => f.slice(repoKey(root).length + 1).replace(/\.jsonl?$/, ''));
    return [...new Set(names)];
  } catch {
    return [];
  }
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
