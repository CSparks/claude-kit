// detached-land.test.mjs — a landing from a detached HEAD pushes the sha it reports (KIT-T520).
// `git push origin main` pushed the stale local branch and said up-to-date; now the push sends HEAD,
// a detached HEAD that descends from main is reattached, one that does not is refused, and a push
// whose remote does not end up holding HEAD is not reported ok.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { push, attachBranch } from './git.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g, originSha } from './patchkit.mjs';
import { tempDir, cleanup } from './testkit.mjs';

const land = (s, patch = envelope(['beta', 'BETA'])) => {
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta', land: true }, patch);
  writeJob(s.cfg, { ...job, commands: ['node -e "0"'] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('a detached HEAD at main lands: the pushed sha is the reported one and main is reattached', () => {
  const s = fixture();
  try {
    g(['checkout', '-q', '--detach', 'HEAD'], s.root);
    const r = land(s);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(originSha(s.bare, s.root), r.landed.sha, 'the remote holds the landed sha');
    assert.equal(g(['symbolic-ref', '--short', 'HEAD'], s.root), 'main');
  } finally { s.done(); }
});

test('a detached HEAD ahead of main lands that work too (control: the stale local branch is not what gets pushed)', () => {
  const s = fixture();
  try {
    g(['checkout', '-q', '--detach', 'HEAD'], s.root);
    commitOnMain(s.root, 'ahead.txt', 'ahead\n', 'ahead of main');
    const r = land(s);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.equal(originSha(s.bare, s.root), r.landed.sha);
    assert.equal(g(['rev-list', '--count', 'main'], s.root), g(['rev-list', '--count', `origin/main`], s.root));
  } finally { s.done(); }
});

test('a detached HEAD that does not descend from main is refused and nothing is pushed', () => {
  const s = fixture();
  try {
    const before = originSha(s.bare, s.root);
    g(['checkout', '-q', '--detach', 'HEAD~1'], s.root);
    commitOnMain(s.root, 'side.txt', 'side\n', 'side work');
    const r = land(s, '*** write fresh.txt\nfresh\n');
    assert.notEqual(r.status, 'landed');
    assert.match(JSON.stringify(r), /does not descend from main/);
    assert.equal(originSha(s.bare, s.root), before);
  } finally { s.done(); }
});

test('control: a checkout already on main is a no-op for attachBranch', () => {
  const s = fixture();
  try {
    assert.deepEqual(attachBranch(s.root, 'main'), { ok: true });
  } finally { s.done(); }
});

test('a push that lands in another repo is not ok: the remote must hold HEAD', () => {
  const s = fixture();
  const other = tempDir('wrong-bare-');
  try {
    const wrong = join(other, 'wrong.git');
    g(['init', '-q', '--bare', wrong], s.root);
    g(['remote', 'set-url', '--push', 'origin', wrong], s.root);
    commitOnMain(s.root, 'x.txt', 'x\n', 'x');
    const r = push(s.root, 'origin', 'main');
    assert.equal(r.ok, false);
    assert.match(r.err, /not/);
    g(['remote', 'set-url', '--push', 'origin', s.bare], s.root);
    assert.equal(push(s.root, 'origin', 'main').ok, true, 'control: the right remote verifies');
  } finally { s.done(); cleanup(other); }
});
