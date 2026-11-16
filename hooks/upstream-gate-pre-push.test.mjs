#!/usr/bin/env node
// upstream-gate-pre-push.test.mjs — a `git push` of a repo that tracks a pre-push gate git is not set to run is blocked with the
// command that wires it (KIT-T1300). The same repo once wired, a repo with the hook in its git dir, and a repo with no tracked
// hook pass; a submodule is judged by its own config; a git call that cannot run blocks.
// Run: node hooks/upstream-gate-pre-push.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./upstream-gate.mjs', import.meta.url));
const made = [];
const tmp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); made.push(d); return d; };
const git = (cwd, ...args) => execFileSync('git', ['-c', 'protocol.file.allow=always', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const push = (command, cwd, env = process.env) => spawnSync(process.execPath, [HOOK], { cwd, env, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });

function repoWith(hookDir) {
  const dir = tmp('kit-prepush-');
  git(dir, 'init', '-q');
  if (hookDir) {
    mkdirSync(join(dir, hookDir), { recursive: true });
    writeFileSync(join(dir, hookDir, 'pre-push'), '#!/bin/sh\nexit 0\n');
    git(dir, 'add', '--', `${hookDir}/pre-push`);
  } else {
    writeFileSync(join(dir, 'a.txt'), 'x\n');
    git(dir, 'add', '--', 'a.txt');
  }
  git(dir, 'commit', '-q', '-m', 'seed');
  return dir;
}

try {
  const gated = repoWith('.githooks');
  const blocked = push('git push origin main', gated);
  check('a repo with .githooks/pre-push and no core.hooksPath is blocked', blocked.status === 2, blocked.stderr);
  check('the block names the one command that wires it', /config core\.hooksPath \.githooks/.test(blocked.stderr) && /git -C "/.test(blocked.stderr), blocked.stderr);
  check('the block names the check id', /pre-push-wired/.test(blocked.stderr));
  check('a bare git push and a -C push are judged the same way', push('git push', gated).status === 2 && push(`git -C "${gated}" push`, tmp('kit-prepush-away-')).status === 2);
  check('a cd before the push is followed', push(`cd "${gated}" && git push origin main`, tmp('kit-prepush-cd-')).status === 2);

  git(gated, 'config', 'core.hooksPath', '.githooks');
  check('the same repo after the config passes', push('git push origin main', gated).status === 0);

  const inGitDir = repoWith('.githooks');
  writeFileSync(join(inGitDir, '.git', 'hooks', 'pre-push'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(inGitDir, '.git', 'hooks', 'pre-push'), 0o755);
  check('a repo whose git dir holds a pre-push hook passes', push('git push', inGitDir).status === 0);

  const plain = repoWith('');
  check('a repo with no tracked hooks directory passes', push('git push origin main', plain).status === 0);
  check('a command that is no push is untouched', push('git status', gated).status === 0);

  const elsewhere = repoWith('.githooks');
  git(elsewhere, 'config', 'core.hooksPath', 'other');
  check('a hooksPath that holds no pre-push is no wiring', push('git push', elsewhere).status === 2);

  const sub = repoWith('.githooks');
  const outer = repoWith('.githooks');
  git(outer, 'config', 'core.hooksPath', '.githooks');
  git(outer, 'submodule', 'add', '-q', sub, 'framework');
  const framework = join(outer, 'framework');
  check('a submodule checkout is judged by its own config: unwired inside a wired outer repo blocks', push('git push', framework).status === 2, push('git push', framework).stderr);
  check('the outer repo itself, wired, passes', push('git push', outer).status === 0);
  git(framework, 'config', 'core.hooksPath', '.githooks');
  check('the submodule once wired passes', push('git push', framework).status === 0);

  const noHookSub = repoWith('');
  const unwiredOuter = repoWith('.githooks');
  git(unwiredOuter, 'submodule', 'add', '-q', noHookSub, 'lib');
  check('a submodule with no tracked hook passes though the outer repo is unwired', push('git push', join(unwiredOuter, 'lib')).status === 0);
  check('the unwired outer repo blocks', push('git push', unwiredOuter).status === 2);

  const noGit = tmp('kit-prepush-nogit-');
  const withoutGit = { ...process.env, PATH: noGit, Path: noGit };
  const failed = push('git push', gated, withoutGit);
  check('a git call that cannot run blocks and says the check could not complete', failed.status === 2 && /could not be checked/.test(failed.stderr), `${failed.status} ${failed.stderr}`);
  check('a push outside any repository passes', push('git push', tmp('kit-prepush-norepo-')).status === 0);
} finally {
  for (const d of made) rmSync(d, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
