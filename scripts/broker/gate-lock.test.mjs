// gate-lock.test.mjs — the landing's Cargo.lock is consistent before the commit and untouched by the
// broker's own pre-push gate run (KIT-T519): a gate that rewrites the lock must not make the
// repo's pre-push hook refuse the push, and a landing carries the lock its manifests resolve to.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "0"';
const hasCargo = spawnSync('cargo', ['--version'], { shell: true }).status === 0;

// The pre-push hook of a lock-rewriting gate: refuses a dirty Cargo.lock first (as rapid-game's
// does), passes a sha it already stamped, otherwise rewrites the lock, stamps and passes.
function lockRewritingHook(s) {
  const dir = tempDir('gate-lock-hook-');
  const body = [
    'read lref lsha rref rsha',
    'if [ -n "$(git status --porcelain -- Cargo.lock)" ]; then echo "pre-push: refused: uncommitted changes under rust: Cargo.lock" >&2; exit 1; fi',
    'stamp="$(git rev-parse --git-dir)/gate-green"',
    'if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$lsha" ]; then exit 0; fi',
    'echo "# the gate resolved this" >> Cargo.lock',
    'echo "$lsha" > "$stamp"',
  ].join('\n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  g(['config', 'core.hooksPath', dir], s.root);
  return { done: () => cleanup(dir) };
}

const land = (s, env) => {
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }], verify_default: [PASS] });
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta', land: true }, env);
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('a gate that rewrites Cargo.lock does not make the push hook refuse, and leaves the tree clean', () => {
  const s = fixture();
  commitOnMain(s.root, 'Cargo.lock', 'base\n', 'lock');
  g(['push', 'origin', 'main'], s.root);
  const hook = lockRewritingHook(s);
  try {
    const r = land(s, envelope(['beta', 'BETA']));
    assert.equal(r.status, 'landed', JSON.stringify(r.message));
    assert.equal(originSha(s.bare, s.root), r.landed.sha);
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], s.root), '', 'the gate left no lock dirt');
    assert.equal(readFileSync(join(s.root, 'Cargo.lock'), 'utf8'), 'base\n');
  } finally { hook.done(); s.done(); }
});

test('real cargo: a manifest change lands with the lock its manifests resolve to', { skip: !hasCargo }, () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, 'src'));
    writeFileSync(join(s.root, 'Cargo.toml'), '[package]\nname = "locked"\nversion = "0.1.0"\nedition = "2021"\n');
    writeFileSync(join(s.root, 'src', 'lib.rs'), 'pub fn f() {}\n');
    g(['add', '-A'], s.root);
    g(['commit', '-m', 'crate'], s.root);
    assert.equal(spawnSync('cargo', ['generate-lockfile', '--offline'], { cwd: s.root, shell: true }).status, 0);
    g(['add', 'Cargo.lock'], s.root);
    g(['commit', '-m', 'lock'], s.root);
    g(['push', 'origin', 'main'], s.root);
    const r = land(s, `*** edit Cargo.toml\n<<<<<<< SEARCH\nversion = "0.1.0"\n=======\nversion = "0.2.0"\n>>>>>>> REPLACE\n`);
    assert.equal(r.status, 'landed', JSON.stringify(r.message));
    assert.match(g(['show', 'HEAD:Cargo.lock'], s.root), /name = "locked"\s+version = "0\.2\.0"/, 'the landed lock matches the landed manifest');
    assert.equal(g(['status', '--porcelain', '--untracked-files=no'], s.root), '');
  } finally { s.done(); }
});
