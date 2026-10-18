#!/usr/bin/env node
// Tests for .githooks/pre-push (KIT-T458): LFS upload first, then the chain to the repo's own
// <repo>/.githooks/pre-push with the same args and stdin lines; its status is the push's status.
// Run: node scripts/pre-push-chain.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const KIT_HOOK = resolve(fileURLToPath(import.meta.url), '..', '..', '.githooks', 'pre-push');
const STDIN_LINES = 'refs/heads/main aaaa refs/heads/main bbbb\nrefs/heads/x cccc refs/heads/x dddd\n';

// The hook is a POSIX sh script. Git runs it with its own bundled sh; a test launched from PowerShell or
// cmd has no sh on PATH, so the spawn would fail with ENOENT (status null). Resolve git's sh and put its
// directory first on PATH so the hook finds cat, sed and friends.
function shell() {
  if (spawnSync('sh', ['-c', 'exit 0']).status === 0) return { file: 'sh', dirs: [] };
  const exec = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
  for (const rel of [['..', '..', '..', 'usr', 'bin'], ['..', '..', '..', 'bin']]) {
    const dir = resolve(exec, ...rel);
    // mingw64/bin holds the real git.exe: found first, git does not re-prepend its own bin (which carries the real git-lfs) ahead of a fake one.
    if (existsSync(join(dir, 'sh.exe'))) return { file: join(dir, 'sh.exe'), dirs: [dir, resolve(exec, '..', '..', 'bin')] };
  }
  return { file: 'sh', dirs: [] };
}
const SH = shell();
// Windows spells the variable Path or PATH by shell; a spread copy of process.env keeps that spelling,
// so setting env.PATH beside an existing Path leaves the child with the old one.
const withPath = (env, ...front) => {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  const out = { ...env };
  for (const k of Object.keys(out)) if (k.toUpperCase() === 'PATH') delete out[k];
  out.PATH = [...front, env[key]].filter(Boolean).join(delimiter);
  return out;
};
// MSYSTEM is what Git Bash sets: without it git resolves the real git-lfs ahead of a fake one on PATH.
// `front` directories (a fake git-lfs) come ahead of git's own.
const runSh = (args, { front = [], ...opts } = {}) => spawnSync(SH.file, args, { ...opts, env: { MSYSTEM: 'MINGW64', ...withPath(opts.env || process.env, ...front, ...SH.dirs) } });
// A null status never says why on its own: name the spawn error or the signal.
const why = (r) => `status=${r.status} signal=${r.signal} error=${r.error ? r.error.message : 'none'} ${r.stderr || ''}`;

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-prepush-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

// Executable sh script that records "$@" and stdin to <out>, then exits with `code`.
function writeRecorder(path, out, code) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `#!/bin/sh\necho "$@" > "${out}.args"\ncat > "${out}.stdin"\nexit ${code}\n`);
  chmodSync(path, 0o755);
}

// Fake `git-lfs` on PATH so `git lfs pre-push` records what LFS was fed.
function fakeLfsBin(out) {
  const bin = mkdtempSync(join(tmpdir(), 'kit-prepush-bin-'));
  fixtures.push(bin);
  writeRecorder(join(bin, 'git-lfs'), out, 0);
  return bin;
}

function runKit(repo, { lfsBin } = {}) {
  return runSh([KIT_HOOK, 'origin', 'https://example.test/r.git'], { cwd: repo, input: STDIN_LINES, encoding: 'utf8', front: lfsBin ? [lfsBin] : [] });
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// Case 1: red repo hook blocks the push.
{
  const repo = makeRepo();
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 1);
  const r = runKit(repo);
  ok('red repo hook: kit pre-push exits 1', r.status === 1, why(r));
}

// Case 2: green repo hook passes; it gets the args and the stdin lines.
{
  const repo = makeRepo();
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 0);
  const r = runKit(repo);
  ok('green repo hook: kit pre-push exits 0', r.status === 0, why(r));
  ok('repo hook receives the push args', (read(join(repo, 'seen.args')) || '').trim() === 'origin https://example.test/r.git');
  ok('repo hook receives the stdin lines', read(join(repo, 'seen.stdin')) === STDIN_LINES, JSON.stringify(read(join(repo, 'seen.stdin'))));
}

// Case 3: LFS on: LFS and the repo hook both get the same stdin; red repo hook still blocks.
{
  const repo = makeRepo();
  writeFileSync(join(repo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 1);
  const lfsOut = join(repo, 'lfs');
  const r = runKit(repo, { lfsBin: fakeLfsBin(lfsOut) });
  ok('lfs + red repo hook: exits 1', r.status === 1, why(r));
  ok('lfs received the stdin lines', read(`${lfsOut}.stdin`) === STDIN_LINES, JSON.stringify(read(`${lfsOut}.stdin`)));
  ok('repo hook received the same stdin lines LFS got', read(join(repo, 'seen.stdin')) === read(`${lfsOut}.stdin`));
}

// Case 4: no repo hook → today's behaviour (exit 0, LFS still runs).
{
  const repo = makeRepo();
  const r = runKit(repo);
  ok('no repo hook: exits 0', r.status === 0, why(r));
  const lfsRepo = makeRepo();
  writeFileSync(join(lfsRepo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
  const lfsOut = join(lfsRepo, 'lfs');
  const r2 = runKit(lfsRepo, { lfsBin: fakeLfsBin(lfsOut) });
  ok('no repo hook, lfs on: exits 0', r2.status === 0, why(r2));
  ok('no repo hook, lfs on: lfs ran with the stdin lines', read(`${lfsOut}.stdin`) === STDIN_LINES);
}

// Case 5: a failing LFS upload blocks before the repo hook runs.
{
  const repo = makeRepo();
  writeFileSync(join(repo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 0);
  const bin = mkdtempSync(join(tmpdir(), 'kit-prepush-bin-'));
  fixtures.push(bin);
  writeRecorder(join(bin, 'git-lfs'), join(bin, 'lfs'), 7);
  const r = runKit(repo, { lfsBin: bin });
  ok('lfs failure: exits non-zero', r.status !== 0, why(r));
  ok('lfs failure: repo hook not run', read(join(repo, 'seen.args')) === null);
}

// Case 6: the repo's .githooks IS the kit hook directory (hooksPath = own .githooks): no recursion.
{
  const repo = makeRepo();
  mkdirSync(join(repo, '.githooks'), { recursive: true });
  for (const f of ['pre-push', 'lfs-enabled.sh']) {
    writeFileSync(join(repo, '.githooks', f), readFileSync(join(KIT_HOOK, '..', f)));
    chmodSync(join(repo, '.githooks', f), 0o755);
  }
  const r = runSh([join(repo, '.githooks', 'pre-push'), 'origin', 'u'], { cwd: repo, input: STDIN_LINES, encoding: 'utf8', timeout: 15000 });
  ok('self hooksPath: exits 0 without recursing', r.status === 0, why(r));
}

// A work tree at <dir>/w whose gitdir sits apart at <dir>/g (the submodule layout), with a
// committed .githooks/pre-push recorder exiting `code`.
function separateGitdirRepo(code) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-prepush-sep-'));
  fixtures.push(dir);
  const work = join(dir, 'w');
  const gitdir = join(dir, 'g');
  mkdirSync(work);
  execFileSync('git', ['init', '-q', '--separate-git-dir', gitdir], { cwd: work });
  writeRecorder(join(work, '.githooks', 'pre-push'), join(dir, 'seen'), code);
  execFileSync('git', ['add', '-A'], { cwd: work });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'hook'], { cwd: work });
  return { dir, work, gitdir, seen: join(dir, 'seen.args') };
}

// Run the kit hook the way git runs it for a bare repo: cwd and GIT_DIR at the gitdir.
const runAtGitdir = (gitdir) => runSh([KIT_HOOK, 'origin', 'u'], { cwd: gitdir, input: STDIN_LINES, encoding: 'utf8', env: { ...process.env, GIT_DIR: gitdir } });

// Case 7 (KIT-T479): gitdir at core.bare=true + core.worktree → no toplevel → refused with the repair.
{
  const r = separateGitdirRepo(0);
  execFileSync('git', ['--git-dir', r.gitdir, 'config', 'core.bare', 'true']);
  execFileSync('git', ['--git-dir', r.gitdir, 'config', 'core.worktree', r.work]);
  const run = runAtGitdir(r.gitdir);
  ok('bare+worktree gitdir with a tracked repo hook: refused (exit 1)', run.status === 1, why(run));
  ok('bare+worktree: the repair names core.bare false', /repair: git --git-dir=".*" config core\.bare false/.test(run.stderr), run.stderr);
  ok('bare+worktree: the green repo hook never ran', read(r.seen) === null);
  execFileSync('git', ['--git-dir', r.gitdir, 'config', 'core.bare', 'false']);
  const fixed = runSh([KIT_HOOK, 'origin', 'u'], { cwd: r.work, input: STDIN_LINES, encoding: 'utf8' });
  ok('negative control: after the repair the same green hook runs and the push passes', fixed.status === 0 && read(r.seen) !== null, why(fixed));
}

// Case 8 (KIT-T479): HEAD tracks the repo hook but the work tree lost it → refused.
{
  const r = separateGitdirRepo(0);
  rmSync(join(r.work, '.githooks', 'pre-push'));
  const run = runSh([KIT_HOOK, 'origin', 'u'], { cwd: r.work, input: STDIN_LINES, encoding: 'utf8' });
  ok('tracked repo hook missing from the work tree: refused (exit 1)', run.status === 1 && /checkout -- \.githooks\/pre-push/.test(run.stderr), why(run));
}

// Case 9 (negative control): a genuinely bare repo that tracks no repo hook still pushes.
{
  const dir = mkdtempSync(join(tmpdir(), 'kit-prepush-bare-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q', '--bare', dir]);
  const run = runAtGitdir(dir);
  ok('bare repo with no tracked repo hook: exits 0', run.status === 0, why(run));
}

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
console.log(`\npre-push-chain: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
