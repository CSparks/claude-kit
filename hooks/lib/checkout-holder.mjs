// checkout-holder.mjs — which session holds a checkout with a live writer (KIT-T811, KIT-D123). The agent roster
// is per dispatching project, so a session dispatching into another project's checkout cannot see the writer
// another session already has there. This registry is machine-wide and keyed by checkout path: a writer
// dispatch and every Write/Edit in the tree beat the holder's heartbeat; a holder silent for HOLDER_WINDOW_MS,
// or released when its agent stops, no longer holds.
//
//   beatHolder({ tree, session, label, agent, origin, now }) -> record/refresh session's hold on the checkout; origin is the
//                                                    repo the session itself works in
//   refuseEdit({ tree, session, path })              -> note a refused edit (session-overlap.mjs ignores it in the write ledger); beatHolder({ edited }) clears it
//   noteLegacyClaims({ tree, session, files, now })  -> { file: firstSeenMs } for claims with no recorded write HEAD (live-claims.mjs bounds them)
//   liveHolders(tree, now, { strict })             -> [{ tree, session, label, agent, origin, since, beatAt, file }] inside the window;
//                                                    an unreadable registry answers [] and, with strict, throws (a checkout with no entries answers [])
//   releaseTree(tree, session)                       -> drop that session's hold (a synchronous writer finished)
//   releaseAgent(agent)                              -> drop every hold and file claim whose last writer was that agent (SubagentStop)
//   agentEntries(id)                                 -> [{ agent, beatAt, kind }] every hold and claim of the agent (full id or a prefix of 8+)
//   claimFile({ tree, session, agent, label, rel, head, now }) -> record that the writer changed `rel` at `head` (KIT-T1114)
//   liveClaimants(tree, now, { strict })             -> [{ session, agent, label, beatAt, claims }] writers of every session with standing claims
//   HOLDER_WINDOW_MS, holdersDir()                   -> CLAUDE_KIT_HOLDERS_DIR overrides the directory (tests)

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const HOLDER_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;
const HASH_CHARS = 16;
const MAX_REFUSED = 200;

const AGENT_CLAIM_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_CLAIMS = 500;
const MIN_AGENT_PREFIX = 8;
const CLAIMS_DIR = '_claims';

export const holdersDir = () => process.env.CLAUDE_KIT_HOLDERS_DIR || join(homedir(), '.claude', 'claude-kit-holders');
const claimsRoot = () => join(holdersDir(), CLAIMS_DIR);
const normTree = (tree) => String(tree || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const treeDir = (tree) => join(holdersDir(), createHash('sha1').update(normTree(tree)).digest('hex').slice(0, HASH_CHARS));
const entryFile = (tree, session) => join(treeDir(tree), `${String(session).replace(/[^\w.-]/g, '_')}.json`);
const claimTreeDir = (tree) => join(claimsRoot(), createHash('sha1').update(normTree(tree)).digest('hex').slice(0, HASH_CHARS));
const claimEntryFile = (tree, session, agent) => join(claimTreeDir(tree), `${String(`${session}.${agent}`).replace(/[^\w.-]/g, '_')}.json`);

const MISSING = 'ENOENT';

// With `strict`, an entry that cannot be read or parsed throws instead of answering null: a writer the caller cannot
// see is no proof that none is live. A file that vanished between listing and reading is a released entry.
function readEntry(file, strict = false) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (strict && e.code !== MISSING) throw e;
    return null;
  }
}

// The entry files of one checkout's directory. A checkout with no directory has no entries while the registry itself
// exists; with `strict`, any other failure, or a missing registry, throws.
function entryPaths(dir, strict) {
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch (e) {
    if (strict && !(e.code === MISSING && existsSync(holdersDir()))) throw e;
    return [];
  }
}

export function beatHolder({ tree, session, label = '', agent = '', origin = '', edited = '', now = Date.now() }) {
  try {
    if (!tree || !session) return;
    const file = entryFile(tree, session);
    const prev = readEntry(file);
    mkdirSync(treeDir(tree), { recursive: true });
    const refused = (prev?.refused || []).filter((f) => f !== edited);
    writeFileSync(file, JSON.stringify({ tree, session, label: label || prev?.label || '', agent: agent || prev?.agent || '', origin: origin || prev?.origin || '', since: prev?.since || now, beatAt: now, refused, legacySeen: prev?.legacySeen || {} }));
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

// When each of `files` was first judged for the session: a claim recorded without a write HEAD can name no commit that
// releases it, so its age since this first sighting bounds it. Returns { file: firstSeenMs }; an unreadable entry
// answers "just now", which keeps the claim.
export function noteLegacyClaims({ tree, session, files, now = Date.now() }) {
  const justNow = () => Object.fromEntries(files.map((f) => [f, now]));
  try {
    const file = entryFile(tree, session);
    const prev = readEntry(file);
    if (!prev) return justNow();
    const seen = { ...(prev.legacySeen || {}) };
    const fresh = files.filter((f) => seen[f] === undefined);
    for (const f of fresh) seen[f] = now;
    if (fresh.length) writeFileSync(file, JSON.stringify({ ...prev, legacySeen: seen }));
    return Object.fromEntries(files.map((f) => [f, seen[f]]));
  } catch {
    return justNow();
  }
}

export function liveHolders(tree, now = Date.now(), { strict = false } = {}) {
  try {
    return entryPaths(treeDir(tree), strict).flatMap((file) => {
      const entry = readEntry(file, strict);
      if (!entry) return [];
      if (now - entry.beatAt >= PRUNE_AFTER_MS) { rmSync(file, { force: true }); return []; }
      return now - entry.beatAt < HOLDER_WINDOW_MS ? [{ ...entry, file }] : [];
    });
  } catch (e) {
    if (strict) throw e;
    return [];
  }
}

export function releaseTree(tree, session) {
  try { rmSync(entryFile(tree, session), { force: true }); } catch { /* nothing held */ }
}

function eachFile(dir, visit) {
  for (const name of readdirSync(dir)) visit(join(dir, name));
}

export function releaseAgent(agent) {
  try {
    if (!agent) return;
    for (const dir of readdirSync(holdersDir())) {
      if (dir === CLAIMS_DIR) continue;
      eachFile(join(holdersDir(), dir), (file) => { if (readEntry(file)?.agent === agent) rmSync(file, { force: true }); });
    }
    for (const dir of readdirSync(claimsRoot())) {
      eachFile(join(claimsRoot(), dir), (file) => { if (readEntry(file)?.agent === agent) rmSync(file, { force: true }); });
    }
  } catch {
    /* nothing held */
  }
}

/**
 * Every hold and file claim recorded for the agent named by `id` (the full id, or a prefix of at least MIN_AGENT_PREFIX
 * characters), with the time of its last write: [{ agent, beatAt, kind }]. Read by `claims --release` (KIT-T1287).
 */
export function agentEntries(id) {
  const wanted = String(id || '');
  if (wanted.length < MIN_AGENT_PREFIX) return [];
  const found = [];
  const scan = (dir, kind) => {
    try { eachFile(dir, (file) => { const e = readEntry(file); if (e && e.agent && e.agent.startsWith(wanted)) found.push({ agent: e.agent, beatAt: e.beatAt || 0, kind }); }); } catch { /* none */ }
  };
  try {
    for (const dir of readdirSync(holdersDir())) if (dir !== CLAIMS_DIR) scan(join(holdersDir(), dir), 'hold');
    for (const dir of readdirSync(claimsRoot())) scan(join(claimsRoot(), dir), 'claim');
  } catch { /* an empty registry holds nothing */ }
  return found;
}

// Per-writer file claims (KIT-T1114): which files each writer (a session's main thread or one of its subagents) has
// changed, with the HEAD at its latest write. One record per tree and writer, apart from the session-level holds above.
export function claimFile({ tree, session, agent = '', label = '', rel, head = '', now = Date.now() }) {
  try {
    if (!tree || !session || !rel) return;
    const file = claimEntryFile(tree, session, agent);
    const prev = readEntry(file) || {};
    const claims = { ...(prev.claims || {}) };
    delete claims[rel];
    claims[rel] = head;
    const kept = Object.fromEntries(Object.entries(claims).slice(-MAX_CLAIMS));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ tree, session, agent, label: label || prev.label || '', beatAt: now, claims: kept }));
  } catch {
    /* a claim record never breaks the tool call that carried it */
  }
}

// The writers of every session in `tree` with a claim still standing: a subagent until it stops or AGENT_CLAIM_WINDOW_MS pass
// without a write, a main thread for HOLDER_WINDOW_MS.
export function liveClaimants(tree, now = Date.now(), { strict = false } = {}) {
  try {
    return entryPaths(claimTreeDir(tree), strict).flatMap((file) => {
      const entry = readEntry(file, strict);
      const window = entry?.agent ? AGENT_CLAIM_WINDOW_MS : HOLDER_WINDOW_MS;
      return entry && now - entry.beatAt < window ? [entry] : [];
    });
  } catch (e) {
    if (strict) throw e;
    return [];
  }
}
