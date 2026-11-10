// checkout-holder.mjs — which session holds a checkout with a live writer (KIT-T811, KIT-D123). The agent roster
// is per dispatching project, so a session dispatching into another project's checkout cannot see the writer
// another session already has there. This registry is machine-wide and keyed by checkout path: a writer
// dispatch and every Write/Edit in the tree beat the holder's heartbeat; a holder silent for HOLDER_WINDOW_MS,
// or released when its agent stops, no longer holds.
//
//   beatHolder({ tree, session, label, agent, origin, now }) -> record/refresh session's hold on the checkout; origin is the
//                                                    repo the session itself works in
//   refuseEdit({ tree, session, path })              -> note a refused edit (session-overlap.mjs ignores it in the write ledger); beatHolder({ edited }) clears it
//   liveHolders(tree, now)                          -> [{ tree, session, label, agent, origin, since, beatAt, file }] inside the window
//   releaseTree(tree, session)                       -> drop that session's hold (a synchronous writer finished)
//   releaseAgent(agent)                              -> drop every hold whose last writer was that agent (SubagentStop)
//   HOLDER_WINDOW_MS, holdersDir()                   -> CLAUDE_KIT_HOLDERS_DIR overrides the directory (tests)

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOLDER_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const HASH_CHARS = 16;
const MAX_REFUSED = 200;

export const holdersDir = () => process.env.CLAUDE_KIT_HOLDERS_DIR || join(homedir(), '.claude', 'claude-kit-holders');
const normTree = (tree) => String(tree || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const treeDir = (tree) => join(holdersDir(), createHash('sha1').update(normTree(tree)).digest('hex').slice(0, HASH_CHARS));
const entryFile = (tree, session) => join(treeDir(tree), `${String(session).replace(/[^\w.-]/g, '_')}.json`);

function readEntry(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export function beatHolder({ tree, session, label = '', agent = '', origin = '', edited = '', now = Date.now() }) {
  try {
    if (!tree || !session) return;
    const file = entryFile(tree, session);
    const prev = readEntry(file);
    mkdirSync(treeDir(tree), { recursive: true });
    const refused = (prev?.refused || []).filter((f) => f !== edited);
    writeFileSync(file, JSON.stringify({ tree, session, label: label || prev?.label || '', agent: agent || prev?.agent || '', origin: origin || prev?.origin || '', since: prev?.since || now, beatAt: now, refused }));
  } catch {
    /* a heartbeat never breaks the tool call that carried it */
  }
}

// An edit of `path` was refused for the session: the write ledger still lists it, but the session never changed it.
export function refuseEdit({ tree, session, path, now = Date.now() }) {
  try {
    if (!tree || !session) return;
    const file = entryFile(tree, session);
    const prev = readEntry(file) || { tree, session, since: now, beatAt: now };
    const refused = [...new Set([...(prev.refused || []), path])].slice(-MAX_REFUSED);
    mkdirSync(treeDir(tree), { recursive: true });
    writeFileSync(file, JSON.stringify({ ...prev, refused }));
  } catch {
    /* a refusal record never breaks the tool call that carried it */
  }
}

export function liveHolders(tree, now = Date.now()) {
  try {
    const dir = treeDir(tree);
    return readdirSync(dir).flatMap((name) => {
      const file = join(dir, name);
      const entry = readEntry(file);
      if (!entry) return [];
      if (now - entry.beatAt >= PRUNE_AFTER_MS) { rmSync(file, { force: true }); return []; }
      return now - entry.beatAt < HOLDER_WINDOW_MS ? [{ ...entry, file }] : [];
    });
  } catch {
    return [];
  }
}

export function releaseTree(tree, session) {
  try { rmSync(entryFile(tree, session), { force: true }); } catch { /* nothing held */ }
}

export function releaseAgent(agent) {
  try {
    if (!agent) return;
    for (const dir of readdirSync(holdersDir())) {
      for (const name of readdirSync(join(holdersDir(), dir))) {
        const file = join(holdersDir(), dir, name);
        if (readEntry(file)?.agent === agent) rmSync(file, { force: true });
      }
    }
  } catch {
    /* nothing held */
  }
}
