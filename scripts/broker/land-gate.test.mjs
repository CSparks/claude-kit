// land-gate.test.mjs — the repo's pre-push gate and the landing (KIT-T482 item 3): the hook sees
// the shared build cache; a refused push strands no local commit; with `pre_push: true` the daemon
// runs the gate before `git push`, so a gate that stamps its green run passes the push at once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, g, originSha, snapshot } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const PASS = 'node -e "0"';

// A hooks dir whose pre-push appends "<mode> CARGO_TARGET_DIR=… CARGO_BUILD_JOBS=…" to a log.
// mode: 'refuse' exits 1; 'stamp' runs the "gate" once per sha (stamp in the git dir) and passes.
function withHook(s, mode) {
  const dir = tempDir('land-hook-');
  const log = join(dir, 'hook.log').replace(/\\/g, '/');
  const body = mode === 'refuse'
    ? `echo "refused CARGO_TARGET_DIR=$CARGO_TARGET_DIR" >> "${log}"; echo "pre-push: refused: uncommitted changes under rust/" >&2; exit 1`
    : [
      'read lref lsha rref rsha',
      'stamp="$(git rev-parse --git-dir)/gate-green"',
      `if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$lsha" ]; then echo "fast" >> "${log}"; exit 0; fi`,
      `echo "gate CARGO_TARGET_DIR=$CARGO_TARGET_DIR CARGO_BUILD_JOBS=$CARGO_BUILD_JOBS" >> "${log}"`,
      'echo "$lsha" > "$stamp"',
    ].join('\n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  g(['config', 'core.hooksPath', dir], s.root);
  return { lines: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim()) : []), done: () => cleanup(dir) };
}

const land = (s, prePush) => {
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: prePush }], verify_default: [PASS], parallelism: { jobs: 2 } });
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta', land: true }, envelope(['beta', 'BETA']));
  writeJob(s.cfg, job);
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('the push hook runs with the shared CARGO_TARGET_DIR and the broker -j (gate-env)', () => {
  const s = fixture();
  const hook = withHook(s, 'stamp');
  try {
    const r = land(s, false);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(hook.lines(), [`gate CARGO_TARGET_DIR=${s.cfg.targetDir} CARGO_BUILD_JOBS=2`]);
  } finally { hook.done(); s.done(); }
});

test('a refused push leaves no local commit and the tree as it was (land-gate-dirty)', () => {
  const s = fixture();
  const hook = withHook(s, 'refuse');
  try {
    const head = g(['rev-parse', 'HEAD'], s.root);
    const before = snapshot(s.root);
    const r = land(s, false);
    assert.equal(r.status, 'failed', JSON.stringify(r));
    assert.match(r.message, /refused/);
    assert.equal(g(['rev-parse', 'HEAD'], s.root), head, 'no stranded local commit');
    assert.equal(originSha(s.bare, s.root), head);
    assert.deepEqual(snapshot(s.root), before);
  } finally { hook.done(); s.done(); }
});

test('pre_push: the daemon runs the gate before git push, so the push itself takes the stamp fast path', () => {
  const s = fixture();
  const hook = withHook(s, 'stamp');
  try {
    const r = land(s, true);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(hook.lines(), [`gate CARGO_TARGET_DIR=${s.cfg.targetDir} CARGO_BUILD_JOBS=2`, 'fast']);
    assert.equal(originSha(s.bare, s.root), r.landed.sha);
  } finally { hook.done(); s.done(); }
});

test('pre_push with a refusing gate fails before any push and strands nothing; negative: no hook, plain landing', () => {
  const s = fixture();
  const hook = withHook(s, 'refuse');
  try {
    const head = g(['rev-parse', 'HEAD'], s.root);
    const r = land(s, true);
    assert.equal(r.status, 'failed');
    assert.deepEqual(hook.lines().length, 1, 'only the daemon ran the gate; no push was attempted');
    assert.equal(g(['rev-parse', 'HEAD'], s.root), head);
  } finally { hook.done(); s.done(); }
  const plain = fixture();
  try {
    assert.equal(land(plain, true).status, 'landed', 'a repo with no pre-push hook lands as before');
  } finally { plain.done(); }
});
