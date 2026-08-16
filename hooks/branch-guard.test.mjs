// branch-guard (KIT-T082): a branch FLIP of a shared checkout blocks; file-ops, worktree
// adds, both escapes and non-adopted repos pass. Wiring is asserted from hooks.json.
// Run: node hooks/branch-guard.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HOOKS, adopted, cleanup, git, hook, identify, reporter, repo } from './test-harness.mjs';

const { ok, done } = reporter('branch-guard');

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const bgEntry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('branch-guard')));
  ok('branch-guard: wired into hooks.json for Bash AND PowerShell (KIT-T082)',
    !!bgEntry && /\bBash\b/.test(bgEntry.matcher) && /\bPowerShell\b/.test(bgEntry.matcher));

  const bg = identify(adopted(false));
  writeFileSync(join(bg, 'f.txt'), 'x\n');
  git(['add', '-A'], bg);
  git(['commit', '-q', '-m', 'seed'], bg);
  git(['branch', 'feature-x'], bg);
  const bgHook = (command, cwd = bg) => hook('branch-guard.mjs', { tool_input: { command } }, cwd);

  ok('branch-guard: git switch <branch> blocks (KIT-T082)', (() => { const r = bgHook('git switch feature-x'); return r.code === 2 && r.out.includes('KIT-T082'); })());
  ok('branch-guard: git checkout -b <new> blocks', bgHook('git checkout -b brand-new').code === 2);
  ok('branch-guard: git checkout <existing-branch> blocks', bgHook('git checkout feature-x').code === 2);
  ok('branch-guard: git switch -c <new> blocks', bgHook('git switch -c another').code === 2);
  ok('branch-guard: file-restore checkout (-- file) is allowed', bgHook('git checkout -- f.txt').code === 0);
  ok('branch-guard: checkout of a non-branch path is allowed', bgHook('git checkout f.txt').code === 0);
  ok('branch-guard: git worktree add is allowed (the safe path)', bgHook('git worktree add ../wt -b feature-x').code === 0);
  ok('branch-guard: git branch (no switch) is allowed', bgHook('git branch list-only').code === 0);
  ok('branch-guard: [allow-branch:] escape is allowed', bgHook('git switch feature-x [allow-branch: deliberate]').code === 0);
  ok('branch-guard: CLAUDE_KIT_ALLOW_BRANCH=1 escape is allowed', hook('branch-guard.mjs', { tool_input: { command: 'git switch feature-x' } }, bg, { CLAUDE_KIT_ALLOW_BRANCH: '1' }).code === 0);
  ok('branch-guard: a non-git command no-ops', bgHook('echo switch checkout').code === 0);
  ok('branch-guard: non-adopted repo no-ops', hook('branch-guard.mjs', { tool_input: { command: 'git switch feature-x' } }, repo()).code === 0);
} finally {
  cleanup();
}

done();
