#!/usr/bin/env node
// landed-commits-pull.test.mjs — only commits this clone made count as landings of the turn (KIT-T1278): the upstream commits a
// `git pull --rebase` brings in are another session's, a local commit replayed onto them counts once under its new sha, and an
// ordinary local commit counts whether or not it is pushed. The Stop gate (landedThisTurn) and `t receipt` list the same commits.
// Run: node hooks/landed-commits-pull.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { landedThisTurn } from './lib/landed-commits.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('landed-commits-pull');
const OLD = '2020-01-01T00:00:00Z';
const TURN_LEAD_MS = 1000;
const state = mkdtempSync(join(tmpdir(), 'kit-landed-pull-state-'));
process.env.CLAUDE_KIT_TURN_STATE = state;
const { buildReceipt } = await import('../scripts/t-receipt.mjs');

const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();
const commit = (cwd, file, text, subject, date = '') => {
  writeFileSync(join(cwd, file), text);
  sh(cwd, 'add', '--', file);
  const env = date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {};
  execFileSync('git', ['commit', '-q', '-m', subject], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...env } });
  return sh(cwd, 'rev-parse', 'HEAD');
};
const clone = (remote, name) => {
  const dir = tmpDir(`kit-landed-pull-${name}-`);
  sh(dir, 'clone', '-q', remote, '.');
  sh(dir, 'config', 'user.email', 't@t');
  sh(dir, 'config', 'user.name', 't');
  return dir;
};
const shas = (root, turnStartMs) => landedThisTurn(root, turnStartMs).map((c) => c.sha);

try {
  const remote = tmpDir('kit-landed-pull-remote-');
  sh(remote, 'init', '-q', '--bare', '-b', 'main');
  const seed = clone(remote, 'seed');
  sh(seed, 'checkout', '-q', '-b', 'main');
  commit(seed, 'a.rs', 'fn a() {}\n', 'seed', OLD);
  sh(seed, 'push', '-q', 'origin', 'main');

  const mine = clone(remote, 'mine');
  const pullOnly = clone(remote, 'pullonly');
  const turnStart = Date.now() - TURN_LEAD_MS;

  const other = clone(remote, 'other');
  const upstream = ['b', 'c', 'd'].map((n) => commit(other, `${n}.rs`, `fn ${n}() {}\n`, `other session ${n} RDG-T077`));
  sh(other, 'push', '-q', 'origin', 'main');

  sh(pullOnly, 'pull', '-q', '--rebase', 'origin', 'main');
  ok('a pull that brings upstream commits demands none of them', shas(pullOnly, turnStart).length === 0, shas(pullOnly, turnStart).join());

  const l1 = commit(mine, 'l1.rs', 'fn l1() {}\n', 'local one KIT-T1');
  const l2 = commit(mine, 'l2.rs', 'fn l2() {}\n', 'local two KIT-T2');
  ok('an ordinary local commit is demanded', shas(mine, turnStart).includes(l1) && shas(mine, turnStart).includes(l2), shas(mine, turnStart).join());

  sh(mine, 'pull', '-q', '--rebase', 'origin', 'main');
  const after = shas(mine, turnStart);
  const [l1New, l2New] = [sh(mine, 'rev-parse', 'HEAD~1'), sh(mine, 'rev-parse', 'HEAD')];
  ok('the rebased commits have new shas', l1New !== l1 && l2New !== l2);
  ok('a local commit rebased onto the upstream ones is demanded once, under its new sha', after.filter((s) => s === l1New).length === 1 && after.filter((s) => s === l2New).length === 1, after.join());
  ok('the old shas are not demanded', !after.includes(l1) && !after.includes(l2));
  ok('no upstream commit is demanded after the rebase', upstream.every((s) => !after.includes(s)) && after.length === 2, after.join());

  sh(mine, 'push', '-q', 'origin', 'main');
  ok('the session\'s own commits still count once pushed', shas(mine, turnStart).length === 2);

  const receipt = buildReceipt(mine, {}, Date.now());
  ok('t receipt lists the rebased local commits and no upstream commit', receipt.text.includes(l1New.slice(0, 7)) && receipt.text.includes(l2New.slice(0, 7)) && upstream.every((s) => !receipt.text.includes(s.slice(0, 7))), receipt.text);
  const receiptPull = buildReceipt(pullOnly, {}, Date.now());
  ok('t receipt after a pull alone says nothing landed', /nothing landed/.test(receiptPull.text), receiptPull.text);
} finally {
  cleanup();
  rmSync(state, { recursive: true, force: true });
}
done();
