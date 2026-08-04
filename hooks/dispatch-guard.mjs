#!/usr/bin/env node
// PreToolUse (Task|Agent) — the dispatch gate. Every check here fires at the ONE choke point
// where a delegation's cost is decided: the moment it is dispatched.
//   dispatch-ladder      (KIT-T151) — the silent fable inherit
//   cold-worktree-build  (KIT-T176) — worktree isolation into a Rust workspace with no target/
//   shared-tree-dispatch (KIT-T176) — a second agent into a checkout that already has one
// exit 2 = block, 0 = allow. No-ops on unadopted repos; FAIL-OPEN everywhere else.
//
// Every check is independent: it decides on its own escape token, its own ignore-file key, and
// contributes its own message. A dispatch violating two shapes hears about both at once rather
// than paying a round trip per gate.

import { readFileSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter, readAgents, partitionAgents } from './lib.mjs';

const LADDER_CHECK = 'dispatch-ladder';
const COLD_BUILD_CHECK = 'cold-worktree-build';
const SHARED_TREE_CHECK = 'shared-tree-dispatch';
const TRANSCRIPT_TAIL_BYTES = 256 * 1024; // enough JSONL tail to find the latest assistant turn
const DEFINITION_HEAD_BYTES = 4 * 1024; // frontmatter lives at the top of an agent .md
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
  const prompt = String(input.prompt || '');

  const blocks = [
    ladderBlock(root, input, prompt, p),
    coldWorktreeBlock(root, input, prompt),
    sharedTreeBlock(root, input, prompt),
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
  if (pinnedModel(root, String(input.subagent_type || ''))) return null; // the definition authored its tier
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
  if (!isWorktree(input)) return null;
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
  if (isWorktree(input)) return null; // its own checkout — this IS the remedy
  if (/\[shared-tree-ok\b/i.test(prompt)) return null;
  if (pathExcluded(root, SHARED_TREE_CHECK, root)) return null;
  const now = Date.now();
  const live = liveAgents(root, now);
  if (!live.length) return null;

  return [
    `BLOCKED: ${live.length} agent(s) already in flight in this working tree.`,
    `  agent: ${label(input)}   roster: .ai/agents.jsonl`,
    ...live.map((r) => `    • ${r.id} (${r.scope || 'general'}, ${minutesAgo(r, now)}m ago) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`),
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

// The roster's live rows: in-flight (no terminal row) AND young enough to still be running.
// Reads through lib's roster accessor — the same path agent-roster.mjs writes, so a centralized
// .ai/ (junction to the data repo) resolves identically. FAIL-OPEN: a missing/corrupt roster,
// or a row with no parseable timestamp, yields nothing to block on.
function liveAgents(root, nowMs) {
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

function minutesAgo(row, nowMs) {
  const t = Date.parse(row.firstSeen || row.ts || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((nowMs - t) / MS_PER_MIN)) : 0;
}

function isWorktree(input) {
  return /^worktree$/i.test(String(input.isolation || '').trim());
}

function label(input) {
  return String(input.subagent_type || '').trim() || '(default)';
}

// Resolve a `model:` pin from the agent definition's frontmatter. Probes the plugin's own
// agents/ (both install layouts), then project- and user-level .claude/agents/. A definition
// FOUND without a model line returns '' — an unpinned type must be routed explicitly.
function pinnedModel(root, subagentType) {
  const name = subagentType.split(':').pop().trim();
  if (!name) return '';
  const hookDir = dirname(fileURLToPath(import.meta.url));
  const probes = [
    process.env.CLAUDE_PLUGIN_ROOT && join(process.env.CLAUDE_PLUGIN_ROOT, 'agents', `${name}.md`),
    join(hookDir, '..', 'agents', `${name}.md`),
    root && join(root, '.claude', 'agents', `${name}.md`),
    join(homedir(), '.claude', 'agents', `${name}.md`),
  ].filter(Boolean);
  for (const file of probes) {
    try {
      if (!existsSync(file)) continue;
      const head = readFileSync(file, 'utf8').slice(0, DEFINITION_HEAD_BYTES);
      const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const m = fm && fm[1].match(/^model:\s*([^\s#]+)/m);
      return m ? m[1] : '';
    } catch {
      /* unreadable probe — try the next layout */
    }
  }
  return '';
}

// The session's model = the latest assistant turn in the transcript JSONL. Indeterminate
// ('' → treated as not-fable) whenever the path is absent or unparseable.
function latestAssistantModel(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';
    const size = statSync(transcriptPath).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = openSync(transcriptPath, 'r');
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const row = JSON.parse(line);
        const model = row && row.type === 'assistant' && row.message && row.message.model;
        if (model) return model;
      } catch {
        /* clipped first line of the tail — keep scanning */
      }
    }
  } catch {
    /* unreadable transcript — indeterminate */
  }
  return '';
}
