#!/usr/bin/env node
// PreToolUse (Task|Agent) — the dispatch gate. Every check here fires at the ONE choke point
// where a delegation's cost is decided: the moment it is dispatched.
//   dispatch-ladder      (KIT-T151) — the silent fable inherit
//   cold-worktree-build  (KIT-T176, KIT-D074) — any worktree dispatch, any project
//   shared-tree-dispatch (KIT-T176, KIT-D077) — a second read/write agent into a checkout that has one
//   broker-owned-tree    (KIT-T276) — a writer-capable agent into a checkout a broker daemon owns
// exit 2 = block, 0 = allow. No-ops on unadopted repos; FAIL-OPEN everywhere else.
//
// Every check is independent: it decides on its own escape token, its own ignore-file key, and
// contributes its own message. A dispatch violating two shapes hears about both at once rather
// than paying a round trip per gate.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter, readAgents, partitionAgents } from './lib.mjs';
import { isWorktreeIsolation, dispatchTargetRoot, rowSharesTree } from './dispatch-target.mjs';
import { readOnlyDispatch, readOnlyRow } from './dispatch-readonly.mjs';
import { ladderRoot } from '../scripts/dispatch-ladder.mjs';
import { capabilityStatus } from '../scripts/model-lineup.mjs';
import { FOREIGN_TREE_CHECK, FOREIGN_TREE_OK, foreignEdits, foreignTreeMessage } from './dispatch-foreign.mjs';
import { BROKER_OWNED_CHECK, brokerOwnedMessage, liveBroker } from './dispatch-broker.mjs';
// The session-model resolver lives in model-tag.mjs: the activity line needs the same answer
// (KIT-T179) — one implementation, two consumers, no drift between gate and tag.
import { latestAssistantModel, modelDisplay, rowModel, isKnownModel } from './model-tag.mjs';

const LADDER_CHECK = 'dispatch-ladder';
const COLD_BUILD_CHECK = 'cold-worktree-build';
const SHARED_TREE_CHECK = 'shared-tree-dispatch';
const STALE_TABLE_CHECK = 'capability-table-stale';
// The only escapes are the maintainer's own words, quoted (KIT-D074). An agent cannot grant itself
// a worktree or a second writer; an empty token does not count.
const MAINTAINER_PARALLEL = /\[maintainer-asked-parallel:\s*[^\]\s][^\]]*\]/i;
const MAINTAINER_WORKTREE = /\[maintainer-asked-worktree:\s*[^\]\s][^\]]*\]/i;
// An in-flight roster row older than this is treated as abandoned, not as a live colleague: the
// harness cannot always report a background agent's completion, so an uncollected row would
// otherwise wedge every later dispatch in the repo.
const SHARED_TREE_WINDOW_MS = 2 * 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const ROSTER_TASK_CHARS = 80; // one scannable line per in-flight agent in the block message
const SERIAL_FIX = [
  'Fix — pick one (never a worktree or second checkout — KIT-D074):',
  '  • serialize: wait for the in-flight agent, collect its result, then hand THAT agent',
  '    (or one new one) the next ticket — warm build, warm context;',
  '  • research only: dispatch a READ-ONLY agent type (no Edit/Write in its tools:',
  '    claude-kit:researcher, claude-kit:analyst, Explore, Plan),',
  '    or add [read-only: <reason>] to the prompt of a writer-capable type;',
  '  • writing in a DIFFERENT checkout: add [tree: <absolute path>] to the prompt;',
  '  • two writers in one checkout only on the maintainer words: include',
  '    [maintainer-asked-parallel: <his words>] in the prompt.',
];

try {
  const p = await payload();
  const input = p.tool_input || {};
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const prompt = String(input.prompt || input.message || '');

  const blocks = [
    ladderBlock(root, input, prompt, p),
    unlabelledBlock(root, input, p),
    staleTableBlock(root, p),
    coldWorktreeBlock(root, input, prompt),
    sharedTreeBlock(root, input, prompt),
    brokerOwnedBlock(root, input, prompt),
    foreignTreeBlock(root, input, prompt, p),
  ].filter(Boolean);
  if (!blocks.length) process.exit(0);
  console.error(blocks.join('\n'));
  process.exit(2);
} catch {
  process.exit(0);
}

// --- dispatch-ladder (KIT-T151) -------------------------------------------------
// WHY: the capability table (KIT-D080) routes delegations DOWN — the orchestrator names a family on
// every dispatch, and kit agents carry no model of their own. But the Agent tool's default is
// "inherit the session model", so on a fable main thread every model-less delegation silently
// runs on the most expensive family. Lived failure (2026-07-23, groovegrid): five researcher
// delegations inherited fable and burned ~105k subagent tokens before the miss was caught.
//
// BLOCKS exactly the failure mode — the SILENT INHERIT: no model on the call and the latest
// assistant turn in the session transcript is fable. An EXPLICIT model on the call (fable
// included) always passes: a named family is a visible, deliberate choice.
// ALLOWS: any explicit model; indeterminate parent model (cannot prove a fable inherit — fail open).
// ESCAPE: inline [allow-fable: <reason>] in the delegation prompt, or CLAUDE_KIT_ALLOW_FABLE=1
//   (keeps a deliberate model-less fable delegation possible without naming a tier).
function ladderBlock(root, input, prompt, p) {
  if (pathExcluded(root, LADDER_CHECK, root)) return null;
  const escaped =
    /\[allow-fable\b/i.test(prompt) ||
    /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_FABLE || '');
  if (escaped) return null;
  if (input.model) return null; // an explicit model IS the choice — any tier, fable included
  const parent = latestAssistantModel(p.transcript_path);
  if (!/fable/i.test(String(parent || ''))) return null; // cannot prove a fable inherit — fail open

  return [
    'BLOCKED: this delegation would run on fable — the orchestration tier.',
    `  agent: ${label(input)}   cause: no model on the call — inherits the fable session (${parent})`,
    '',
    'The kit capability table (.ai/config.yml dispatch.jobs, KIT-D080) picks a family per job:',
    'fixes and refactors -> sonnet; big builds, design, assets -> opus; trivial chores -> haiku;',
    'fable is for orchestration + explicit-only work — and must be CHOSEN, never inherited.',
    'Kit agents carry no model; the call must name one.',
    '',
    "Fix: pass an explicit model on the Agent call — model:'sonnet', 'opus' or 'haiku' (resolve",
    "with: node <kit>/scripts/dispatch-ladder.mjs resolve --job <job>), or model:'fable' if",
    'this genuinely needs the top family.',
    'To keep a model-less fable inherit: include [allow-fable: <reason>] in the prompt.',
    '',
    excludeFooter(LADDER_CHECK),
  ].join('\n');
}

// --- unlabelled dispatch (KIT-T403) ----------------------------------------------
// The roster row, the activity line and every agent listing print the model first; a dispatch whose
// model cannot be resolved (or names no known family) would be written unlabelled, so it never starts.
function unlabelledBlock(root, input, p) {
  if (!p.tool_input) return null; // unparseable payload — fail open
  if (pathExcluded(root, LADDER_CHECK, root)) return null;
  const model = rowModel(root, input, p);
  if (model && isKnownModel(model)) return null;
  const cause = model ? `unknown model "${model}"` : 'no model on the call and none resolvable from the session';
  return [
    'BLOCKED: this delegation cannot be labelled with a model (KIT-T403).',
    `  agent: ${label(input)}   cause: ${cause}`,
    '',
    'Every agent listing prints [model] first; a dispatch with no resolvable model is refused.',
    "Fix: pass an explicit model on the Agent call — model:'sonnet', 'opus', 'haiku' or 'fable'",
    '(resolve with: node <kit>/scripts/dispatch-ladder.mjs resolve --job <job>), or include',
    '[allow-fable: <reason>] in the prompt for a deliberate model-less fable inherit.',
    '',
    excludeFooter(LADDER_CHECK),
  ].join('\n');
}

// --- capability-table-stale (KIT-T339) --------------------------------------------
// Model routing reads only the kit capability table; a table older than dispatch.refresh_days or
// behind a newer known model is guessing. The fix is the research refresh, not an override.
function staleTableBlock(root, p) {
  if (!p.tool_input) return null;
  if (pathExcluded(root, STALE_TABLE_CHECK, root)) return null;
  let status;
  try {
    status = capabilityStatus();
  } catch {
    return null;
  }
  if (!status.stale) return null;
  return [
    'BLOCKED: the model capability table is stale (KIT-T339).',
    ...status.reasons.map((r) => `  - ${r}`),
    '',
    'Dispatch routes by cost and capability per model; a stale table routes by guesswork.',
    `Fix: run the refresh — node ${join(ladderRoot(), 'scripts', 'model-refresh.mjs')} — then review the proposed`,
    'decision in .ai/decisions/ and move the aliases in .ai/config.yml dispatch.aliases if a newer model landed.',
    '',
    excludeFooter(STALE_TABLE_CHECK),
  ].join('\n');
}

// --- cold-worktree-build (KIT-T176, KIT-D074) -----------------------------------
// Every project keeps ONE checkout on main: a worktree dispatch — isolation:"worktree" or a
// hand-made worktree named in the brief — blocks outright, in any adopted repo. Only the
// maintainer's own request, quoted in the escape token, lifts it.
function coldWorktreeBlock(root, input, prompt) {
  if (!isWorktreeIsolation(input.isolation) && !namesWorktree(prompt)) return null;
  if (MAINTAINER_WORKTREE.test(prompt)) return null;
  if (pathExcluded(root, COLD_BUILD_CHECK, root)) return null;

  return [
    'BLOCKED: worktree / separate-checkout dispatch (KIT-D039, KIT-D074).',
    `  agent: ${label(input)}   root: ${root}`,
    '',
    'Every project uses ONE checkout on main: no worktrees, clones, feature branches or second',
    'work directories. Separate copies duplicate effort, strand work, and in Rust each pays a',
    'cold build (2026-08-04: 30+ min silent; 2026-09-28: an agent moved half-done work into',
    'D:/dev/stiletto-d2 and force-deleted it).',
    '',
    'Fix: drop isolation:"worktree" and run in the main checkout, one writing agent at a time;',
    'keep the tree building by testing each step. Only if the maintainer explicitly asked for',
    'a worktree: include [maintainer-asked-worktree: <his words>] in the prompt.',
    '',
    excludeFooter(COLD_BUILD_CHECK),
  ].join('\n');
}

// --- shared-tree-dispatch (KIT-T176) --------------------------------------------
// ONE read/write agent per checkout (KIT-D077). The checkout is the dispatch's `[tree: …]` token,
// else the path its brief names, else the session's. Read-only dispatches and rows never count.
function sharedTreeBlock(root, input, prompt) {
  if (isWorktreeIsolation(input.isolation)) return null; // not this tree — cold-worktree-build rules on it
  if (MAINTAINER_PARALLEL.test(prompt)) return null;
  if (readOnlyDispatch(root, label(input), prompt)) return null;
  if (pathExcluded(root, SHARED_TREE_CHECK, root)) return null;
  const now = Date.now();
  const tree = dispatchTargetRoot(root, input);
  const live = liveAgents(root, now, tree).filter((r) => !readOnlyRow(root, r));
  if (!live.length) return null;

  return [
    `BLOCKED: ${live.length} read/write agent(s) already in flight in this working tree.`,
    `  agent: ${label(input)}   tree: ${tree}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}${rosterModel(r)}, ${minutesAgo(r, now)}m ago) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
    '',
    'The rule: one read/write agent per checkout; read-only agents are unrestricted. Two writers',
    "share one HEAD and one index: they poll each other's half-written files, and a branch/stage",
    "op by one sweeps the other's work into the wrong commit.",
    '',
    ...SERIAL_FIX,
    '',
    excludeFooter(SHARED_TREE_CHECK),
  ].join('\n');
}

// --- broker-owned-tree (KIT-T276) ---------------------------------------------
// While a broker daemon holds the target tree's lock it is the only writer: writer-capable
// dispatches are blocked, read-only ones (patch-worker included) pass.
function brokerOwnedBlock(root, input, prompt) {
  if (isWorktreeIsolation(input.isolation) || MAINTAINER_PARALLEL.test(prompt)) return null;
  if (readOnlyDispatch(root, label(input), prompt)) return null;
  if (pathExcluded(root, BROKER_OWNED_CHECK, root)) return null;
  const tree = dispatchTargetRoot(root, input);
  const held = liveBroker(tree);
  return held ? brokerOwnedMessage({ agent: label(input), tree, held, footer: excludeFooter(BROKER_OWNED_CHECK) }) : null;
}

// --- foreign-tree-edits (KIT-T407) ---------------------------------------------
// A writer into a tree already dirty with edits this session did not make. Roster writers in
// flight are shared-tree-dispatch's business and are skipped here.
function foreignTreeBlock(root, input, prompt, p) {
  if (isWorktreeIsolation(input.isolation) || MAINTAINER_PARALLEL.test(prompt) || FOREIGN_TREE_OK.test(prompt)) return null;
  if (readOnlyDispatch(root, label(input), prompt)) return null;
  if (pathExcluded(root, FOREIGN_TREE_CHECK, root)) return null;
  const tree = dispatchTargetRoot(root, input);
  if (liveAgents(root, Date.now(), tree).some((r) => !readOnlyRow(root, r))) return null;
  const files = foreignEdits(tree, p.session_id);
  return files.length ? foreignTreeMessage({ agent: label(input), tree, files, footer: excludeFooter(FOREIGN_TREE_CHECK) }) : null;
}

// Does the brief name a checkout that is a git WORKTREE? A worktree's .git is a FILE whose
// gitdir points into `<repo>/.git/worktrees/<name>`. A SUBMODULE's .git is a file too, but its
// gitdir points into `.git/modules/` — naming a submodule (every rapid-game brief does) is not
// a worktree dispatch.
function namesWorktree(prompt) {
  try {
    for (const m of String(prompt).matchAll(/(?:[A-Za-z]:[\\/]|\/)[^\s"'`)\],;]+/g)) {
      const marker = join(m[0].replace(/[.,;:!?)\]}"'`]+$/, ''), '.git');
      if (!existsSync(marker) || !statSync(marker).isFile()) continue;
      if (/gitdir:.*[\\/]worktrees[\\/]/i.test(readFileSync(marker, 'utf8'))) return true;
    }
  } catch {
    /* fail open */
  }
  return false;
}

// The roster's rows that are genuine COLLEAGUES IN `tree`: in-flight (no terminal row), young
// enough to still be running, and landing in this same checkout — not off in their own worktree,
// not aimed at another repo (KIT-T177; the roster is session-scoped, the rule is tree-scoped).
// Reads through lib's roster accessor — the same path agent-roster.mjs writes, so a centralized
// .ai/ (junction to the data repo) resolves identically. FAIL-OPEN: a missing/corrupt roster,
// or a row with no parseable timestamp, yields nothing to block on.
//
// RESIDUAL: a row whose agent never emits a terminal event (the harness does not guarantee
// SubagentStop for every dispatch shape) still counts until the stale window ages it out. That
// is the deliberate conservative side — visible in the block message, escapable per dispatch.
function liveAgents(root, nowMs, tree) {
  try {
    const { inFlight } = partitionAgents(readAgents(root), nowMs);
    return inFlight.filter((r) => {
      const t = Date.parse(r.firstSeen || r.ts || '');
      if (!Number.isFinite(t) || nowMs - t >= SHARED_TREE_WINDOW_MS) return false;
      return rowSharesTree(r, tree);
    });
  } catch {
    return [];
  }
}

function minutesAgo(row, nowMs) {
  const t = Date.parse(row.firstSeen || row.ts || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((nowMs - t) / MS_PER_MIN)) : 0;
}

// ` [Opus 5]` for a roster row that recorded one; '' for a pre-KIT-T179 row, which therefore
// renders exactly as it always did.
function rosterModel(row) {
  const display = modelDisplay(row && row.model);
  return display ? ` [${display}]` : '';
}

function label(input) {
  return String(input.subagent_type || input.agent_type || input.task_name || '').trim() || '(default)';
}
