#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.
// KIT-T071: gist + q-pointer design — essentials inline, big content behind commands.
// Target: ≤1.2k tokens per session. FAIL-OPEN throughout. The sections live in hooks/lib/orient/, one per concern;
// this script runs them in output order. q.mjs / id-utils.mjs are imported dynamically at their try-wrapped use
// sites so a broken scripts/ tree degrades one section instead of crashing orientation (KIT-T055).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, gitRoot, projectName } from './lib.mjs';
import { fitOrientation } from './lib/orient-budget.mjs';
import { cacheDir } from './lib/stat-cache.mjs';
import { agentsSection } from './lib/orient/agents.mjs';
import { CODEX, firstExisting } from './lib/orient/common.mjs';
import { decisionViews, kitDecisionsSection, recentSection, standingSection } from './lib/orient/decisions.mjs';
import { header, identity, notices } from './lib/orient/notices.mjs';
import { lineageSection, roadmapSection, sessionSection } from './lib/orient/record.mjs';
import { worktreeSection } from './lib/orient/worktree.mjs';
import { governsSection, mentionsSection, openWorkSection, porcelainPath, zombiesSection } from './lib/orient/work.mjs';

const root = gitRoot();
// No store above the cwd: fall back to the unbounded catch-all rather than no-op'ing, so a
// session in a home/scratch dir still gets a destination and a session id (KIT-T189).
if (!adopted(root)) {
  const { orientUnbounded } = await import('./orient-unbounded.mjs');
  process.exit(await orientUnbounded());
}

// Over-budget orientation is shortened to what the harness will inline; the untruncated text
// is kept on disk and named in each shortened block.
const budgeted = (text) => {
  const full = join(cacheDir(), `orient-${projectName(root)}.txt`);
  const fit = fitOrientation(text, { pointer: ` — full: ${full}` });
  if (fit.demoted.length) {
    try { mkdirSync(cacheDir(), { recursive: true }); writeFileSync(full, text); } catch { /* the pointer is then dead; the trimmed text still stands */ }
  }
  return fit.text;
};

const ctx = { root, out: [] };
const { out } = ctx;
const roadmap = firstExisting(join(root, '.ai', 'ROADMAP.md'), join(root, 'ROADMAP.md'));
const decisionsFile = firstExisting(join(root, '.ai', 'DECISIONS.md'), join(root, 'DECISIONS.md'));
const views = decisionViews(root);

header(ctx);
await notices(ctx);
const foundational = identity(ctx, views);
const { repos, wips, recentCommitLines } = await worktreeSection(ctx);
sessionSection(ctx, join(root, '.ai', 'SESSION.md'));
await agentsSection(ctx);
roadmapSection(ctx, roadmap);

// Active signals for standing-decision scope filtering.
const changedPaths = [];
for (const [r] of repos) {
  try { for (const l of wips.get(r).dirty) { const p = porcelainPath(l); if (p) changedPaths.push(p); } } catch { /* skip */ }
}
const standing = standingSection(ctx, views, changedPaths.join(' ') + ' ' + recentCommitLines, changedPaths);
recentSection(ctx, views, decisionsFile);
await kitDecisionsSection(ctx);
await openWorkSection(ctx);
await mentionsSection(ctx);
zombiesSection(ctx);
lineageSection(ctx);
await governsSection(ctx, { changedPaths, standing, foundational });

out.push(`
--- IDENTITY & PROCESS (main thread) ---
${CODEX
    ? 'Use subagents only when the user asks for delegation/parallel work or higher-priority instructions allow it.'
    : 'ORCHESTRATOR: delegate substantial work to subagents (lean brief: ticket+file:line, not pasted files).'}
Inline: genuinely tiny single-file edits.${CODEX ? '' : ' Batch related small tasks into one subagent.'}
Work order: drain's job (.ai/config.yml + roadmap + active doing ticket) — pull and dispatch.
Questions → ${CODEX ? 'structured user input when available' : 'AskUserQuestion'} (never prose), with recommended option first.
QUERY don't grep: q open|governing|trail|fts; code-graph importers-of|defines|surface|duplicate-defines.
PROVENANCE FIRST (KIT-T079): git log -- <path> + code-graph BEFORE any runtime theory.
Read plan-of-record + DECISIONS before non-trivial work. On-disk record and git are AUTHORITATIVE.
Log work to a ticket (gate enforces). Record decisions in DECISIONS the turn they happen.
Full rules: read ${CODEX ? 'AGENTS.md' : 'CLAUDE.md'} | q governing <hook-file> | code-graph --query surface
================================================================================`);
let text = budgeted(out.join('\n'));
try {
  const { contextLine, estimateTokens } = await import('../scripts/context-budget.mjs');
  text += `\n${contextLine({ orientTokens: estimateTokens(text), root })}`;
} catch {
  /* the cost line is best-effort */
}
console.log(text);
