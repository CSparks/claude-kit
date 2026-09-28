#!/usr/bin/env node
// PreToolUse (Task|Agent) — the dispatch gate. Every check here fires at the ONE choke point
// where a delegation's cost is decided: the moment it is dispatched.
//   dispatch-ladder      (KIT-T151) — the silent fable inherit
//   cold-worktree-build  (KIT-T176, KIT-D074) — any worktree dispatch, any project
//   shared-tree-dispatch (KIT-T176) — a second writing agent into a checkout that has one
//   parallel-dispatch    (KIT-T256) — a second writing agent in flight AT ALL in a Rust workspace
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
import { pinnedModel, definitionTools, latestAssistantModel, modelDisplay } from './model-tag.mjs';

const LADDER_CHECK = 'dispatch-ladder';
const COLD_BUILD_CHECK = 'cold-worktree-build';
const SHARED_TREE_CHECK = 'shared-tree-dispatch';
const PARALLEL_CHECK = 'parallel-dispatch';
// The only escapes are the maintainer's own words, quoted (KIT-D074). An agent cannot grant itself
// a worktree or a second writer; an empty token does not count.
const MAINTAINER_PARALLEL = /\[maintainer-asked-parallel:\s*[^\]\s][^\]]*\]/i;
const MAINTAINER_WORKTREE = /\[maintainer-asked-worktree:\s*[^\]\s][^\]]*\]/i;
const RETIRED_PARALLEL = /\[allow-parallel\b/i;
// An in-flight roster row older than this is treated as abandoned, not as a live colleague: the
// harness cannot always report a background agent's completion, so an uncollected row would
// otherwise wedge every later dispatch in the repo.
const SHARED_TREE_WINDOW_MS = 2 * 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
// Tools that write the working tree. A type granted none of them is READ-ONLY (a researcher,
// a reviewer, the built-in Explore/Plan): it has no edit→build→measure loop and leaves no
// half-written files, so it neither pays nor imposes the shared-tree and parallel costs.
const WRITE_TOOLS = /^(Edit|Write|NotebookEdit|MultiEdit)$/i;
const BUILTIN_READ_ONLY = new Set(['explore', 'plan', 'claude-code-guide']);
const ROSTER_TASK_CHARS = 80; // one scannable line per in-flight agent in the block message
// Remedy lines shared by the shared-tree and parallel blocks: serialize, or send a read-only
// agent type, or quote the maintainer.
const SERIAL_FIX = [
  'Fix — pick one (never a worktree or second checkout — KIT-D074):',
  '  • serialize: wait for the in-flight agent, collect its result, then hand THAT agent',
  '    (or one new one) the next ticket — warm build, warm context;',
  '  • analysis only: dispatch a READ-ONLY agent type instead (claude-kit:analyst,',
  '    claude-kit:analyst-max, claude-kit:researcher, Explore) — they run alongside a writer;',
  '  • only if the maintainer explicitly asked for parallel writers: include',
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
// ONE writing agent per working tree. Concurrent writers share a single HEAD + index, so they
// pay to poll each other's half-written files and a branch/stage op by one corrupts the
// other's in-flight work. Read-only agent TYPES (no writing tool in their definition) pass.
function sharedTreeBlock(root, input, prompt) {
  if (isWorktreeIsolation(input.isolation)) return null; // not this tree — cold-worktree-build rules on it
  if (MAINTAINER_PARALLEL.test(prompt)) return null;
  if (readOnlyAgent(root, label(input))) return null; // nothing to corrupt, nothing to poll
  if (pathExcluded(root, SHARED_TREE_CHECK, root)) return null;
  const now = Date.now();
  const tree = dispatchTargetRoot(root, input);
  const live = liveAgents(root, now, tree).filter((r) => !readOnlyAgent(root, r.scope));
  if (!live.length) return null;

  return [
    `BLOCKED: ${live.length} agent(s) already in flight in this working tree.`,
    `  agent: ${label(input)}   tree: ${tree}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}${rosterModel(r)}, ${minutesAgo(r, now)}m ago) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
    '',
    'NEVER run two agents in one working tree unless all but one are read-only types: one HEAD,',
    "one index. They pay to poll each other's half-written files, and a branch/stage op by one",
    "sweeps the other's work into the wrong commit (2026-08-03: a billed agent waited out a",
    'broken refactor, then built a throwaway scratch crate to work around it).',
    '',
    ...SERIAL_FIX,
    '',
    excludeFooter(SHARED_TREE_CHECK),
  ].join('\n');
}

// --- parallel-dispatch (KIT-T256, KIT-D074) --------------------------------------
// ONE writing agent at a time in a Rust workspace, whatever tree it is in: every writer
// iterates edit→build→measure and the builds contend for one box (2026-08-25: four lanes,
// ~300-600k tokens each). Read-only agent TYPES pass. A repo with no Cargo.toml is left to
// shared-tree-dispatch. ESCAPE: only [maintainer-asked-parallel: <his words>].
function parallelBlock(root, input, prompt) {
  if (!existsSync(join(root, 'Cargo.toml'))) return null; // no compile loop — no gate
  if (MAINTAINER_PARALLEL.test(prompt)) return null;
  if (readOnlyAgent(root, label(input))) return null; // analytical lane — no build to contend
  if (pathExcluded(root, PARALLEL_CHECK, root)) return null;
  const now = Date.now();
  const live = liveAnywhere(root, now).filter((r) => !readOnlyAgent(root, r.scope));
  if (!live.length) return null;

  return [
    `BLOCKED: ${live.length} agent(s) already in flight — ONE agent at a time.`,
    `  agent: ${label(input)}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}${rosterModel(r)}, ${minutesAgo(r, now)}m ago${isWorktreeIsolation(r.isolation) ? ', own worktree' : ''}) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
    '',
    'In a Rust workspace, parallel read/write agents are slower AND dearer than one agent',
    'working the tickets in sequence: every writer iterates edit→build→measure, each pays its',
    'own build and context, and the builds contend for one box.',
    'Lived case (2026-08-25): four lanes, ~300-600k tokens each.',
    ...(RETIRED_PARALLEL.test(prompt) ? ['', 'The [allow-parallel: …] token is retired (KIT-D074): only the maintainer lifts this.'] : []),
    '',
    ...SERIAL_FIX,
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

// A type is read-only when it is a built-in analytical agent or its definition's `tools:`
// grants no writing tool. Unknown types and definitions granting everything count as writers.
function readOnlyAgent(root, type) {
  const name = String(type || '').split(':').pop().trim().toLowerCase();
  if (BUILTIN_READ_ONLY.has(name)) return true;
  const tools = definitionTools(root, type);
  return Array.isArray(tools) && !tools.some((t) => WRITE_TOOLS.test(t));
}
