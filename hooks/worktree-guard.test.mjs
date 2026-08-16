// Automated test for the worktree gate (hooks/worktree-guard.mjs) — both checks.
// worktree-stash (KIT-T233): BLOCK `git stash` (push/pop/apply/drop/bare) in a linked
//   worktree; ALLOW in the main checkout, on [allow-stash:], via env, via the ignore file,
//   on a non-git command, and in an unadopted repo.
// worktree-cwd (KIT-T115): WARN (exit 0 + stderr) on a mutating git command whose cwd is
//   under .claude/worktrees/; silent for a read-only command, an explicit `git -C`, and
//   for a cwd outside .claude/worktrees/.
// Run: node hooks/worktree-guard.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./worktree-guard.mjs', import.meta.url));
let failures = 0;

function seedRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wg-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  return dir;
}

// A real linked worktree under .claude/worktrees/, as the Agent tool's isolation creates.
function addWorktree(repo, name = 'agent-1') {
  const wt = join(repo, '.claude', 'worktrees', name);
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-q', wt, '-b', `worktree-${name}`], { cwd: repo });
  return wt;
}

// A linked worktree OUTSIDE .claude/worktrees/ — only --git-common-dir reveals it.
function addSiblingWorktree(repo, name = 'sib') {
  const wt = join(mkdtempSync(join(tmpdir(), 'wgs-')), name);
  execFileSync('git', ['worktree', 'add', '-q', wt, '-b', `sibling-${name}`], { cwd: repo });
  return wt;
}

function run(cwd, command, env = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_ALLOW_STASH: '', CLAUDE_PLUGIN_ROOT: '', ...env },
  });
  return { code: r.status, err: r.stderr || '' };
}

function ok(name, pass) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) failures++;
}

const repo = seedRepo();
const wt = addWorktree(repo);
const sib = addSiblingWorktree(repo);
const unadopted = seedRepo({ adopt: false });
const unadoptedWt = addWorktree(unadopted, 'agent-u');

// --- worktree-stash (KIT-T233) -------------------------------------------------------
for (const cmd of ['git stash', 'git stash push -m base', 'git stash pop', 'git stash apply', 'git stash drop']) {
  const r = run(wt, cmd);
  ok(`worktree-stash: blocks \`${cmd}\` in a worktree`, r.code === 2 && r.err.includes('KIT-T233'));
}
ok('worktree-stash: block names the check-id + both exclusion surfaces', (() => {
  const e = run(wt, 'git stash').err;
  return e.includes('id: worktree-stash') && e.includes('.claude-kit-ignore.yaml') && e.includes('claude-kit-ignore-start worktree-stash');
})());
ok('worktree-stash: blocks in a worktree OUTSIDE .claude/worktrees (common-dir check)', run(sib, 'git stash push').code === 2);
ok('worktree-stash: blocks a chained stash (git add -A && git stash)', run(wt, 'git add -A && git stash').code === 2);
ok('worktree-stash: allowed in the MAIN checkout', run(repo, 'git stash push -m base').code === 0);
ok('worktree-stash: [allow-stash:] escape is allowed', run(wt, 'git stash push [allow-stash: deliberate]').code === 0);
ok('worktree-stash: CLAUDE_KIT_ALLOW_STASH=1 escape is allowed', run(wt, 'git stash push', { CLAUDE_KIT_ALLOW_STASH: '1' }).code === 0);
ok('worktree-stash: a non-git command no-ops', run(wt, 'echo git stash pop').code === 0);
ok('worktree-stash: `git status` in a worktree is untouched', run(wt, 'git status').code === 0);
ok('worktree-stash: unadopted repo no-ops', run(unadoptedWt, 'git stash push').code === 0);
ok('worktree-stash: ignore-file exclusion lets it through', (() => {
  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), 'worktree-stash:\n  - "**"\n');
  const r = run(wt, 'git stash push');
  writeFileSync(join(repo, '.claude-kit-ignore.yaml'), '');
  return r.code === 0;
})());
ok('worktree-stash: git -C <worktree> from the main checkout blocks', run(repo, `git -C ${wt.replace(/\\/g, '/')} stash push`).code === 2);

// --- worktree-cwd (KIT-T115) ---------------------------------------------------------
for (const cmd of ['git commit -m x', 'git merge main', 'git push', 'git rebase main', 'git reset --hard', 'git cherry-pick abc123']) {
  const r = run(wt, cmd);
  ok(`worktree-cwd: warns (exit 0) on \`${cmd}\` with an implicit worktree cwd`, r.code === 0 && r.err.includes('KIT-T115'));
}
ok('worktree-cwd: the warning names the check-id + how to fix', (() => {
  const e = run(wt, 'git commit -m x').err;
  return e.includes('id: worktree-cwd') && e.includes('git -C <repo-root>');
})());
ok('worktree-cwd: read-only git command does NOT warn', run(wt, 'git log --oneline -5').err.includes('KIT-T115') === false);
ok('worktree-cwd: explicit `git -C` target suppresses the warning', run(wt, `git -C ${wt.replace(/\\/g, '/')} commit -m x`).err.includes('KIT-T115') === false);
ok('worktree-cwd: mutating command in the MAIN checkout does not warn', run(repo, 'git commit -m x').err.includes('KIT-T115') === false);
ok('worktree-cwd: a sibling worktree (not under .claude/worktrees) does not warn', run(sib, 'git commit -m x').err.includes('KIT-T115') === false);
ok('worktree-cwd: unadopted repo no-ops', run(unadoptedWt, 'git commit -m x').err.includes('KIT-T115') === false);

// --- wiring ---------------------------------------------------------------------------
ok('wiring: registered in hooks.json for Bash AND PowerShell', (() => {
  const wiring = JSON.parse(readFileSync(fileURLToPath(new URL('./hooks.json', import.meta.url)), 'utf8'));
  const e = wiring.hooks.PreToolUse.find((x) => x.hooks.some((h) => h.command.includes('worktree-guard')));
  return !!e && /\bBash\b/.test(e.matcher) && /\bPowerShell\b/.test(e.matcher);
})());

// --- fail-open -----------------------------------------------------------------------
ok('fail-open: malformed payload exits 0', (() => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: wt, input: '{not json', encoding: 'utf8' });
  return r.status === 0;
})());

console.log(failures ? `\n${failures} FAILED` : '\nAll worktree-guard tests passed.');
process.exit(failures ? 1 : 0);
