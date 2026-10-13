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
  const env = { ...process.env };
  if (lfsBin) env.PATH = lfsBin + delimiter + env.PATH;
  return spawnSync('sh', [KIT_HOOK, 'origin', 'https://example.test/r.git'], { cwd: repo, input: STDIN_LINES, encoding: 'utf8', env });
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// Case 1: red repo hook blocks the push.
{
  const repo = makeRepo();
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 1);
  const r = runKit(repo);
  ok('red repo hook: kit pre-push exits 1', r.status === 1, `status=${r.status} ${r.stderr}`);
}

// Case 2: green repo hook passes; it gets the args and the stdin lines.
{
  const repo = makeRepo();
  writeRecorder(join(repo, '.githooks', 'pre-push'), join(repo, 'seen'), 0);
  const r = runKit(repo);
  ok('green repo hook: kit pre-push exits 0', r.status === 0, `status=${r.status} ${r.stderr}`);
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
  ok('lfs + red repo hook: exits 1', r.status === 1, `status=${r.status} ${r.stderr}`);
  ok('lfs received the stdin lines', read(`${lfsOut}.stdin`) === STDIN_LINES, JSON.stringify(read(`${lfsOut}.stdin`)));
  ok('repo hook received the same stdin lines LFS got', read(join(repo, 'seen.stdin')) === read(`${lfsOut}.stdin`));
}

// Case 4: no repo hook → today's behaviour (exit 0, LFS still runs).
{
  const repo = makeRepo();
  const r = runKit(repo);
  ok('no repo hook: exits 0', r.status === 0, `status=${r.status} ${r.stderr}`);
  const lfsRepo = makeRepo();
  writeFileSync(join(lfsRepo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
  const lfsOut = join(lfsRepo, 'lfs');
  const r2 = runKit(lfsRepo, { lfsBin: fakeLfsBin(lfsOut) });
  ok('no repo hook, lfs on: exits 0', r2.status === 0, r2.stderr);
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
  ok('lfs failure: exits non-zero', r.status !== 0, `status=${r.status}`);
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
  const r = spawnSync('sh', [join(repo, '.githooks', 'pre-push'), 'origin', 'u'], { cwd: repo, input: STDIN_LINES, encoding: 'utf8', timeout: 15000 });
  ok('self hooksPath: exits 0 without recursing', r.status === 0, `status=${r.status} signal=${r.signal} ${r.stderr}`);
}

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
console.log(`\npre-push-chain: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
