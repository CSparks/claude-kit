#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — two worktree-safety checks on git commands.
// exit 2 = block, 0 = allow/warn. No-ops on unadopted repos; fails open on any error.
//
// worktree-stash (KIT-T233) — BLOCK `git stash` in a linked worktree. refs/stash lives in
//   the COMMON git dir, so every worktree shares one stash stack and parallel agents pop
//   each other's entries. Escape: [allow-stash: <reason>] or CLAUDE_KIT_ALLOW_STASH=1.
//
// worktree-cwd (KIT-T115) — WARN (stderr, exit 0) when a MUTATING git command runs with an
//   implicit cwd under .claude/worktrees/. A persistent shell that drifted into a finished
//   agent worktree lands commits on the agent branch. An explicit `git -C <dir>` / leading
//   `cd <dir>` means the worktree was chosen on purpose — no warning.

import { dirname } from 'node:path';
import { payload, git, gitRoot, adopted, excludeFooter, pathExcluded } from './lib.mjs';

const MUTATING = new Set(['commit', 'merge', 'push', 'rebase', 'reset', 'checkout', 'switch', 'cherry-pick', 'am', 'revert']);
const GLOBAL_VALUE_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const WORKTREE_DIR = /(^|[\\/])\.claude[\\/]worktrees[\\/]/i;

const tokenize = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
const normalize = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a command names explicitly (leading `cd <dir>` or `git -C <dir>`), or ''.
function explicitDir(cmd) {
  let m = cmd.match(/(?:^|&&|;)\s*cd\s+(\S[^&;|]*)/);
  if (m) return normalize(m[1].trim());
  m = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
  return m ? normalize(m[1].trim()) : '';
}

// A LINKED worktree has a .git file pointing at the main repo, so --git-dir and
// --git-common-dir differ. The path check catches the kit's own agent worktrees even
// when git resolution is unavailable.
function inWorktree(dir) {
  if (WORKTREE_DIR.test(String(dir).replace(/\\/g, '/') + '/')) return true;
  const gitDir = git(['rev-parse', '--absolute-git-dir'], dir).trim();
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], dir).trim();
  if (!gitDir || !common) return false;
  const norm = (p) => p.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
  return norm(gitDir) !== norm(common);
}

// The MAIN checkout's root — the parent of the shared git dir (same as the repo root when
// `dir` is not a linked worktree). '' when git cannot resolve it.
function mainRoot(dir) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], dir).trim();
  return common ? dirname(common.replace(/\\/g, '/')) : '';
}

// Each `git …` segment of a shell line, reduced to its subcommand + remaining tokens.
function gitSegments(command) {
  const out = [];
  for (const seg of command.split(/&&|\|\||[;&|]/).map((s) => s.trim()).filter(Boolean)) {
    // The segment must BE a git invocation (env assignments / sudo may precede it) — a
    // `git …` merely quoted inside another command is not one.
    const m = seg.match(/^(?:\w+=\S*\s+)*(?:sudo\s+)?git\s+(.+)/s);
    if (!m) continue;
    const toks = tokenize(m[1]);
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (GLOBAL_VALUE_OPTS.has(t)) { i += 2; continue; }
      if (t.startsWith('-')) { i++; continue; }
      break;
    }
    if (toks[i]) out.push({ sub: toks[i], rest: toks.slice(i + 1), seg });
  }
  return out;
}

try {
  const p = await payload();
  const command = (p.tool_input && p.tool_input.command) || '';
  if (!/\bgit\b/.test(command)) process.exit(0);

  const named = explicitDir(command);
  const dir = named || process.cwd();
  // Adoption is a property of the REPO, not of the checkout: a linked worktree may not
  // carry .ai/ on its branch, so the main checkout answers for it.
  const root = gitRoot(dir);
  const main = mainRoot(dir);
  if (!adopted(root) && !adopted(main)) process.exit(0);

  const segs = gitSegments(command);
  const allowStash = /\[allow-stash\b/i.test(command) || /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_STASH || '');

  const excluded = (id) => pathExcluded(root, id, dir) || (!!main && pathExcluded(main, id, dir));

  if (!allowStash && !excluded('worktree-stash') && segs.some((s) => s.sub === 'stash') && inWorktree(dir)) {
    process.stderr.write(
      [
        '',
        'BLOCKED: git stash inside a git worktree (KIT-T233).',
        `  ${command.trim()}`,
        '',
        'refs/stash lives in the COMMON git dir, so every worktree shares ONE stash stack.',
        "A parallel agent's pop/drop can apply or destroy YOUR entry (and a long-lived stash",
        'on the main checkout can be popped into a worktree). Use a private baseline instead:',
        '  git diff > /tmp/baseline.patch && git checkout -- .   # then `git apply` to restore',
        '  git commit -am "wip: baseline"                        # a WIP commit on this branch',
        '',
        'Deliberate, logged escape: include [allow-stash: <reason>] in the command, or set',
        'CLAUDE_KIT_ALLOW_STASH=1.',
      ].join('\n') + excludeFooter('worktree-stash'),
    );
    process.exit(2);
  }

  // Only an IMPLICIT cwd can be an accident; a named directory was chosen on purpose.
  if (!named && !excluded('worktree-cwd') && WORKTREE_DIR.test(process.cwd().replace(/\\/g, '/') + '/')) {
    const mutating = segs.filter((s) => MUTATING.has(s.sub)).map((s) => s.sub);
    if (mutating.length) {
      process.stderr.write(
        [
          '',
          `WARNING: mutating git command (${[...new Set(mutating)].join(', ')}) in an agent worktree (KIT-T115).`,
          `  cwd: ${process.cwd()}`,
          '',
          'This shell is inside .claude/worktrees/ — the commit/merge lands on the AGENT branch,',
          'not the repo you probably meant. `cd` to the repo root first, or name the target:',
          '  git -C <repo-root> <command>',
          '',
          'If the worktree IS the target, pass it explicitly (git -C <worktree> …) to silence this.',
        ].join('\n') + excludeFooter('worktree-cwd'),
      );
    }
  }
  process.exit(0);
} catch {
  process.exit(0); // fail-open per HOOK CONTRACT
}
