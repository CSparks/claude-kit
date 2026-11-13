#!/usr/bin/env node
// PreCompact + Stop — keep the resume ANCHOR (SESSION.md) durable, so a /clear at any point
// loses nothing (KIT-D015 / KIT-T014).
//
//  • PreCompact: remind to flush durable state before context (and detail) is lost. The
//    post-compaction SessionStart (orient) re-surfaces the record. Also surfaces un-triaged
//    inbox items so captured-but-unrouted requests don't die at the context boundary.
//  • Stop: the SESSION-anchor ratchet (mirrors request-gate). SESSION.md is only reliably
//    written at PreCompact, so a mid-work /clear resumes from a stale anchor. This nudges ONCE
//    when meaningful work landed THIS turn (a commit touching project files, or a decision/note/question) but SESSION.md
//    wasn't touched — flipping the burden from "remember to flush" to "clear the gate".
//    First it adds a dated line per landed commit to the anchor (lib/anchor-landings.mjs, KIT-T1150), whoever made
//    the commit; a noted commit no longer counts as unflushed work, but the nudge judges "touched" by the anchor's
//    mtime from BEFORE those lines, so a decision or note edit still needs a real `t session`.
//  • Stop also blocks once on a maintainer ruling captured this turn that still rests in the inbox, and warns
//    on every older one until `t decide --from` / `t triage` moves it out (KIT-T938).
//
// No-ops on unadopted repos. FAIL-OPEN everywhere: a durability hook must never wedge a session
// or block a /clear (the hook contract), so every path exits 0.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, adopted, git, payload, sessionMtimeMs, unboundedRoot } from './lib.mjs';
import { missingCitations } from './session-citations.mjs';
import { triageFooter } from './lib/block-triage.mjs';
import { unresolvedAsks } from '../scripts/question-store.mjs';
import { orphanShells, projectSlug, excludedIds, nagText, ORPHAN_AGE_MIN } from './orphan-shells.mjs';
import { verifyOrphans } from './orphan-verify.mjs';
import { rulingStop } from './lib/ruling-stop.mjs';
import { unpromotedRulings } from './lib/inbox-rulings.mjs';
import { staleWarning } from './lib/ruling-messages.mjs';
import { isNoted, noteLandings } from './lib/anchor-landings.mjs';
import { TURN_SKEW_MS, touchesProjectFiles } from './lib/landed-commits.mjs';

// Cap the dead-citation list so a badly-drifted SESSION.md can't swamp the flush output.
const CITATION_LIST_MAX = 8;

const MS_PER_SEC = 1000; // git %ct is epoch SECONDS; compare in ms
// Stores whose writes count as "meaningful work this turn" for the anchor nudge. tickets and
// inbox are EXCLUDED: status flips and captures are bookkeeping the anchor need not track.
const WORK_STORES = ['decisions', 'notes', 'questions'];

main().catch(() => process.exit(0)); // any failure → allow (fail-open)

async function main() {
  const p = await payload();
  const root = gitRoot();
  // With no store above the cwd the flush used to no-op, which is exactly where a
  // found-but-unapplied fact was lost (KIT-T189): fall back to the unbounded catch-all.
  const unbounded = adopted(root) ? null : unboundedRoot();
  if (!adopted(root) && !unbounded) process.exit(0);
  const store = unbounded || root;

  deadCitationWarning(store);
  await brokerHealthWarning(store);

  if (p.hook_event_name === 'Stop') {
    // The unbounded store lives inside the shared data repo, whose commit stream is other
    // sessions' syncs — not this turn's work. That makes the anchor nudge's evidence a lie
    // here, so it stays a managed-repo ratchet.
    if (!unbounded) {
      unresolvedQuestionWarning(root, p.session_id);
      orphanShellWarning(root, p.session_id);
    }
    stopBlockOnce(store, p, unbounded);
  } else {
    precompactReminder(store);
  }
  process.exit(0);
}

// --- SESSION-cited artifact paths (KIT-T215) ------------------------------------

// WARN (never block) when SESSION.md cites a path-shaped artifact that isn't on disk — the
// signature of a delegated deliverable written to a cwd-relative / session-temp path.
function deadCitationWarning(root) {
  let text;
  try {
    text = readFileSync(join(root, '.ai', 'SESSION.md'), 'utf8');
  } catch {
    return; // no anchor yet — nothing to verify
  }
  const missing = missingCitations(root, text);
  if (!missing.length) return;
  const shown = missing.slice(0, CITATION_LIST_MAX);
  const more = missing.length > CITATION_LIST_MAX ? `\n    (+${missing.length - CITATION_LIST_MAX} more)` : '';
  process.stderr.write(
    `⚠ SESSION.md cites ${missing.length} artifact path(s) that do NOT exist on disk:\n` +
    shown.map((m) => '    ' + m).join('\n') + more + '\n' +
    `Re-anchor each: t session --fix "<old>" "<new>" --all. History that cites a path that is gone stays as written: one line saying the path is stale or renamed clears it (t session "<path> is stale: <why>"). A cited artifact that died with its session is a lost deliverable.\n`,
  );
}

// One line per fault the build broker recorded for itself (KIT-T307); silent when healthy.
async function brokerHealthWarning(root) {
  try {
    const { healthWarnings } = await import('../scripts/broker/health-read.mjs');
    for (const w of healthWarnings(root)) process.stderr.write(`⚠ ${w}\n`);
  } catch {
    /* best-effort */
  }
}

// --- questions asked this session and still open (KIT-T448) -----------------------

function unresolvedQuestionWarning(root, session) {
  try {
    const open = unresolvedAsks(root, String(session || ''), new Date().toISOString().slice(0, 10));
    if (!open.length) return;
    process.stderr.write(
      `⚠ This session asked ${open.length} question(s) that are still open:\n` +
      open.map((q) => `    ${q.id} — answered? write the Resolution: t resolve ${q.id} "<answer>"\n`).join(''),
    );
  } catch {
    /* advisory only */
  }
}

// --- background shells this session started and never closed (KIT-T455) --------

function orphanShellWarning(root, session) {
  try {
    if (!session) return;
    const project = projectSlug(root);
    const list = verifyOrphans(orphanShells({ project, session, minAgeMin: ORPHAN_AGE_MIN, skip: excludedIds(root) }), { project });
    if (list.length) process.stderr.write(nagText(list));
  } catch {
    /* advisory only */
  }
}

// --- PreCompact: flush reminder -------------------------------------------------

function precompactReminder(root) {
  const head = git(['-C', root, 'rev-parse', '--short', 'HEAD']).trim() || 'none';
  const branch = git(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'none';

  let inboxNote = '';
  try {
    const pending = readdirSync(join(root, '.ai', 'inbox')).filter((n) => n.endsWith('.md') && !/^README/i.test(n));
    if (pending.length) {
      inboxNote = `\n- ${pending.length} UN-TRIAGED inbox item(s) — drain (triage) or they vanish at the boundary:\n` +
        pending.slice(0, 10).map((n) => `    .ai/inbox/${n}`).join('\n');
    }
  } catch {
    /* no inbox dir — fine */
  }

  const rulings = unpromotedRulings(root);
  if (rulings.length) inboxNote += `\n${staleWarning(rulings)}`;

  console.log(`=== COMPACTION IMMINENT — flush before detail is lost ===
The on-disk record survives this, not the conversation. Before continuing:
- Decisions/directives from this session -> t decide --file <draft.md> (one decision each)
- Working state + next steps (verbatim commands/paths) -> t session "<state + next steps>" or --file <draft.md> (adds a dated line under the top of ${join(root, '.ai', 'SESSION.md')}; deletes nothing, the previous file is backed up; only --replace --file rewrites it whole)
- In-flight delegated agents -> recorded in ${join(root, '.ai', 'agents.jsonl')} (orient replays them)
- Work in flight -> the plan-of-record / its ticket${inboxNote}
After compaction, trust .ai/ + git (${branch}@${head}) over the summary.
=========================================================`);
}

// --- Stop: the block-once ratchets, one block message, one exit (mirrors request-gate.mjs) ---

// SESSION-anchor ratchet: a turn that landed work without touching SESSION.md. Empty when current or unbounded.
function anchorNudgeText(root, turnStartMs, touchedMs) {
  if (!turnStartMs) return '';
  if (touchedMs >= turnStartMs - TURN_SKEW_MS) return '';  // the anchor is current
  const work = workSince(root, turnStartMs);                           // a no-op turn stays silent
  if (!work) return '';
  return `⚠ SESSION.md is the resume anchor and wasn't updated this turn, but ${work} landed.\n` +
    'The rule: flush at every commit, landing receipt and decision, the same turn, before replying. Run t session "<state + next steps>" (or --file <draft>): it adds a dated line and deletes nothing. Never --replace unless the draft is the complete anchor. Then stop.\n';
}

// A ruling captured this turn blocks once (KIT-T938); older ones only warn. The unbounded store has no anchor to nudge.
function stopBlockOnce(store, p, unbounded) {
  const tx = p.transcript_path;
  const turnStartMs = tx && existsSync(tx) ? lastUserTurnMs(tx) : 0;  // no bounded turn: stay silent (fail-open)
  const rulings = rulingStop(store, { turnStartMs, stopActive: !!p.stop_hook_active });
  if (rulings.warn) process.stderr.write(`${rulings.warn}\n`);
  const touchedMs = sessionMtimeMs(store);  // read before the landing notes below move it
  if (!unbounded) noteLandings(store, turnStartMs);
  const anchor = unbounded || p.stop_hook_active ? '' : anchorNudgeText(store, turnStartMs, touchedMs);
  const blocks = [rulings.block, anchor].filter(Boolean);
  if (!blocks.length) return;
  process.stderr.write(`${blocks.join('\n')}${triageFooter()}`);
  process.exit(2);
}

// "This turn" = since the last real user message (the request-gate's definition). Returns its
// timestamp ms, or 0 when none is found.
function lastUserTurnMs(file) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return 0;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const role = e?.type || e?.message?.role;
    if (role !== 'user' || e?.isMeta === true) continue;
    const content = e?.message?.content;
    if (Array.isArray(content) && content.some((b) => b && b.type === 'tool_result')) continue;
    const text = extractText(content);
    if (text && text.trim() && !isSystemNotice(text)) return Date.parse(e?.timestamp || '') || 0;
  }
  return 0;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

function isSystemNotice(text) {
  return /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i.test(text);
}

// What meaningful work landed since `ms`? A short label naming the first kind found (a commit
// authored this turn and not yet noted in the anchor, or a write into a durable .ai store), else ''
// for "nothing to anchor".
function workSince(root, ms) {
  const tol = ms - TURN_SKEW_MS;
  const lastCommit = git(['-C', root, 'log', '-1', '--format=%ct']).trim();
  if (lastCommit && Number(lastCommit) * MS_PER_SEC >= tol && touchesProjectFiles(root)
    && !isNoted(root, git(['-C', root, 'rev-parse', 'HEAD']).trim())) return 'a commit';
  // A durable store write this turn (a decision/note/question file changed).
  for (const store of WORK_STORES) {
    const dir = join(root, '.ai', store);
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.md') || /^(README|_TEMPLATE|INDEX|REGRESSIONS|SUPERSEDED)\b/i.test(n)) continue;
      try { if (statSync(join(dir, n)).mtimeMs >= tol) return `a ${store} edit`; } catch { /* ignore */ }
    }
  }
  return '';
}
