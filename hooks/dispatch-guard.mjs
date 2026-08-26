#!/usr/bin/env node
// PreToolUse (Task|Agent) — the dispatch gate. Every check here fires at the ONE choke point
// where a delegation's cost is decided: the moment it is dispatched.
//   dispatch-ladder      (KIT-T151) — the silent fable inherit
//   cold-worktree-build  (KIT-T176) — worktree isolation into a Rust workspace with no target/
//   shared-tree-dispatch (KIT-T176) — a second agent into a checkout that already has one
//   parallel-dispatch    (KIT-T256) — a second implementation agent in flight AT ALL, any tree
// exit 2 = block, 0 = allow. No-ops on unadopted repos; FAIL-OPEN everywhere else.
//
// Every check is independent: it decides on its own escape token, its own ignore-file key, and
// contributes its own message. A dispatch violating two shapes hears about both at once rather
// than paying a round trip per gate.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter, readAgents, partitionAgents } from './lib.mjs';
import { isWorktreeIsolation, dispatchTargetRoot, rowSharesTree } from './dispatch-target.mjs';
// The pin + session-model resolvers moved to model-tag.mjs when the activity line needed the same
// answer (KIT-T179) — one implementation, two consumers, no drift between gate and tag.
import { pinnedModel, latestAssistantModel, modelDisplay } from './model-tag.mjs';

const LADDER_CHECK = 'dispatch-ladder';
const COLD_BUILD_CHECK = 'cold-worktree-build';
const SHARED_TREE_CHECK = 'shared-tree-dispatch';
const PARALLEL_CHECK = 'parallel-dispatch';
// The escape must STATE THE COST: a lane count and a per-lane token figure. A bare reason is
// not an escape — the whole point is that the number is written before the spend.
const ALLOW_PARALLEL = /\[allow-parallel:[^\]]*\b\d+\s*k\b[^\]]*\]/i;
const ALLOW_PARALLEL_BARE = /\[allow-parallel\b/i;
// An in-flight roster row older than this is treated as abandoned, not as a live colleague: the
// harness cannot always report a background agent's completion, so an uncollected row would
// otherwise wedge every later dispatch in the repo.
const SHARED_TREE_WINDOW_MS = 2 * 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const ROSTER_TASK_CHARS = 80; // one scannable line per in-flight agent in the block message

try {
  const p = await payload();
  const input = p.tool_input || {};
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const prompt = String(input.prompt || input.message || '');

  const blocks = [
    ladderBlock(root, input, prompt, p),
    coldWorktreeBlock(root, input, prompt),
    sharedTreeBlock(root, input, prompt),
    parallelBlock(root, input, prompt),
  ].filter(Boolean);
  if (!blocks.length) process.exit(0);
  console.error(blocks.join('\n'));
  process.exit(2);
} catch {
  process.exit(0);
}

// --- dispatch-ladder (KIT-T151) -------------------------------------------------
// WHY: the ladder (KIT-D035/D042/D043) routes delegations DOWN — coding/research → opus,
// trivial chores → haiku, fable reserved for orchestration + the hardest reasoning. But the
// Agent tool's default is "inherit the session model", so on a fable main thread every
// model-less delegation silently runs on the most expensive tier. Lived failure (2026-07-23,
// groovegrid): five researcher delegations inherited fable and burned ~105k subagent tokens
// before the miss was caught. Compliance was memory-dependent; this gate makes it structural.
//
// BLOCKS exactly the failure mode — the SILENT INHERIT: no model on the call, no `model:`
// pin in the agent's definition, and the latest assistant turn in the session transcript is
// fable. An EXPLICIT model on the call (fable included) always passes: an explicit tier is a
// visible, deliberate choice, and the config's own deep tier (dispatch.tiers) dispatches
// tickets with model:'fable' explicitly — the gate must not fight the ladder it enforces.
// ALLOWS: any explicit model; a definition that pins a tier (kit agents pin opus);
//   indeterminate parent model (cannot prove a fable inherit — fail open).
// ESCAPE: inline [allow-fable: <reason>] in the delegation prompt, or CLAUDE_KIT_ALLOW_FABLE=1
//   (keeps a deliberate model-less fable delegation possible without naming a tier).
function ladderBlock(root, input, prompt, p) {
  if (pathExcluded(root, LADDER_CHECK, root)) return null;
  const escaped =
    /\[allow-fable\b/i.test(prompt) ||
    /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_FABLE || '');
  if (escaped) return null;
  if (input.model) return null; // an explicit model IS the choice — any tier, fable included
  if (pinnedModel(root, String(input.subagent_type || input.agent_type || input.task_name || ''))) return null; // the definition authored its tier
  const parent = latestAssistantModel(p.transcript_path);
  if (!/fable/i.test(String(parent || ''))) return null; // cannot prove a fable inherit — fail open

  return [
    'BLOCKED: this delegation would run on fable — the orchestration tier.',
    `  agent: ${label(input)}   cause: no model on the call — inherits the fable session (${parent})`,
    '',
    'The dispatch ladder (KIT-D035/D042/D043): coding/implementation/research -> opus;',
    'trivial mechanical chores -> haiku; fable is for orchestration + the hardest',
    'reasoning only — and must be CHOSEN, never inherited.',
    '',
    "Fix: pass an explicit model on the Agent call — model:'opus' (or 'haiku'), or",
    "model:'fable' if this genuinely needs the top tier — or delegate to a kit agent",
    '(researcher/code-reviewer/refactorer/test-author — they pin opus in frontmatter).',
    'To keep a model-less fable inherit: include [allow-fable: <reason>] in the prompt.',
    '',
    excludeFooter(LADDER_CHECK),
  ].join('\n');
}

// --- cold-worktree-build (KIT-T176) ---------------------------------------------
// A fresh git worktree has no target/, so a Rust dispatch there compiles the whole dependency
// graph before it can run anything. Lived failure (2026-08-04, a Bevy workspace): 30+ minutes
// of silent cold build, rustc at 3.3 GB RSS, every second billed. The remedy is cheap and
// belongs in the BRIEF — a shared CARGO_TARGET_DIR makes the same dispatch incremental.
function coldWorktreeBlock(root, input, prompt) {
  // A hand-made worktree named in the brief is the same cold graph as isolation:"worktree" —
  // the 2026-08-25 lanes were spun up with `git worktree add` and dodged this check.
  if (!isWorktreeIsolation(input.isolation) && !namesWorktree(prompt)) return null;
  if (!existsSync(join(root, 'Cargo.toml'))) return null; // not a Rust workspace — no cold graph to pay for
  if (/CARGO_TARGET_DIR/.test(prompt)) return null; // the brief provisions the cache
  if (/\[cold-build-ok\b/i.test(prompt)) return null;
  if (pathExcluded(root, COLD_BUILD_CHECK, root)) return null;

  return [
    'BLOCKED: worktree dispatch into a Rust workspace with no build cache.',
    `  agent: ${label(input)}   isolation: worktree   root: ${join(root, 'Cargo.toml')}`,
    '',
    'A fresh worktree has NO target/, so the agent pays a cold build of the full dependency',
    'graph before it can compile a line of your code. Lived case (2026-08-04, Bevy workspace):',
    '30+ minutes silent, rustc at 3.3 GB RSS, all of it billed — for a change that took minutes.',
    '',
    'Fix — pick one:',
    '  • provision the cache IN THE BRIEF: instruct the agent to set',
    "    CARGO_TARGET_DIR=<main checkout>/target before any cargo command, so the worktree",
    '    builds incrementally against the warm cache instead of from scratch;',
    '  • drop isolation:"worktree" and run in the main checkout (serialize with other agents);',
    '  • accept the cold build deliberately: include [cold-build-ok: <reason>] in the prompt.',
    '',
    excludeFooter(COLD_BUILD_CHECK),
  ].join('\n');
}

// --- shared-tree-dispatch (KIT-T176) --------------------------------------------
// ONE agent per working tree. Concurrent agents share a single HEAD + index, so they pay to
// poll each other's half-written files and a branch/stage op by one corrupts the other's
// in-flight work. Lived failure (2026-08-03): a billed agent waited out a colleague's broken
// refactor, then built a throwaway scratch crate to work around it — all of it billed.
function sharedTreeBlock(root, input, prompt) {
  if (isWorktreeIsolation(input.isolation)) return null; // its own checkout — this IS the remedy
  if (/\[shared-tree-ok\b/i.test(prompt)) return null;
  if (pathExcluded(root, SHARED_TREE_CHECK, root)) return null;
  const now = Date.now();
  const tree = dispatchTargetRoot(root, input);
  const live = liveAgents(root, now, tree);
  if (!live.length) return null;

  return [
    `BLOCKED: ${live.length} agent(s) already in flight in this working tree.`,
    `  agent: ${label(input)}   tree: ${tree}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}${rosterModel(r)}, ${minutesAgo(r, now)}m ago) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
    '',
    "NEVER run two agents in one working tree: one HEAD, one index. They pay to poll each",
    "other's half-written files, and a branch/stage op by one sweeps the other's work into the",
    "wrong commit. Lived case (2026-08-03): a billed agent waited out a colleague's broken",
    'refactor, then built a throwaway scratch crate to work around it.',
    '',
    'Fix — pick one:',
    '  • give this dispatch its own checkout: isolation: "worktree";',
    '  • serialize — wait for the in-flight agent, collect its result, then dispatch;',
    '  • it is genuinely safe to share (disjoint files, read-only work):',
    '    include [shared-tree-ok: <reason>] in the prompt.',
    '',
    excludeFooter(SHARED_TREE_CHECK),
  ].join('\n');
}

// --- parallel-dispatch (KIT-T256) ------------------------------------------------
// ONE implementation agent at a time, whatever tree it is in. Lived failure (2026-08-25,
// stiletto): four agents in four checkouts, ~300-600k tokens EACH, each paying a full cold
// build, contending for one box — slower and dearer than one agent doing the tickets in
// sequence on a warm build. The maintainer's ruling: "One agent doing the work is faster than
// this bullshit. It needs to NEVER HAPPEN AGAIN WITH ENFORCEMENT."
// BLOCKS any dispatch while another agent is in flight (any tree — worktree-isolated rows
//   included; shared-tree-dispatch is tree-scoped, this one is not) — in a RUST workspace.
//   The cost is the compile loop (every writer iterates edit→build→measure, and builds
//   contend for one box); a repo with no Cargo.toml has no such loop and keeps parallel
//   dispatch (the maintainer's scoping, 2026-08-25: "this is primarily a Rust concern").
// ESCAPE: [allow-parallel: N lanes, ~Xk tokens each, <reason>] — the cost figure is REQUIRED;
//   a bare [allow-parallel: reason] still blocks, and the message says what is missing.
function parallelBlock(root, input, prompt) {
  if (!existsSync(join(root, 'Cargo.toml'))) return null; // no compile loop — no gate
  if (ALLOW_PARALLEL.test(prompt)) return null;
  if (pathExcluded(root, PARALLEL_CHECK, root)) return null;
  const now = Date.now();
  const live = liveAnywhere(root, now);
  if (!live.length) return null;
  const bareEscape = ALLOW_PARALLEL_BARE.test(prompt);

  return [
    `BLOCKED: ${live.length} agent(s) already in flight — ONE agent at a time.`,
    `  agent: ${label(input)}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}${rosterModel(r)}, ${minutesAgo(r, now)}m ago${isWorktreeIsolation(r.isolation) ? ', own worktree' : ''}) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
    '',
    'In a Rust workspace, parallel implementation agents are slower AND dearer than one',
    'agent working the tickets in sequence: every writer iterates edit→build→measure, each',
    'pays its own cold build and its own context, and the builds contend for one box.',
    'Lived case (2026-08-25): four lanes, ~300-600k tokens each.',
    '',
    'Fix — pick one:',
    '  • serialize: wait for the in-flight agent, collect its result, then hand THAT agent',
    '    (or one new one) the next ticket — warm build, warm context;',
    bareEscape
      ? '  • your [allow-parallel: …] token names no cost — state it:'
      : '  • genuinely worth running in parallel (rare): state the cost in the prompt —',
    '    [allow-parallel: N lanes, ~Xk tokens each, <why it beats serial>]',
    '',
    excludeFooter(PARALLEL_CHECK),
  ].join('\n');
}

// Every in-flight roster row young enough to still be running, in ANY tree or repo.
function liveAnywhere(root, nowMs) {
  try {
    const { inFlight } = partitionAgents(readAgents(root), nowMs);
    return inFlight.filter((r) => {
      const t = Date.parse(r.firstSeen || r.ts || '');
      return Number.isFinite(t) && nowMs - t < SHARED_TREE_WINDOW_MS;
    });
  } catch {
    return [];
  }
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
