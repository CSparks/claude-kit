// precheck.mjs on a submodule repo (KIT-T649): the superproject's check command does not fit the submodule's workspace, so the
// precheck checks the packages the job's own commands name, from the directory those commands run in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precheckJob } from './precheck.mjs';
import { narrowCheck } from './precheck-scope.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';
const COMMANDS = ['cd rust && cargo t -p rg-graphics --test player_app', 'cd rust && cargo t -p rg-screens --lib pad_'];

test('narrowCheck on a submodule keeps the cd prefix, one workspace, and drops the superproject features', () => {
  assert.equal(narrowCheck(CHECK, COMMANDS, { submodule: true }), 'cd rust && cargo check --offline -p rg-graphics -p rg-screens --lib --test player_app');
  assert.equal(narrowCheck(CHECK, ['cd rust && cargo t -p a --lib', 'cd tools && cargo t -p b --lib'], { submodule: true }), 'cd rust && cargo check --offline -p a --lib');
  assert.equal(narrowCheck(CHECK, ['cargo t -p a --lib'], { submodule: true }), 'cargo check --offline -p a --lib', 'no cd: the repo root');
});

test('control: without the submodule option the check is unchanged (the cd is dropped, the features stay)', () => {
  assert.equal(narrowCheck(CHECK, COMMANDS), 'cargo check --offline -p rg-graphics -p rg-screens --lib --test player_app --features dirt-empire/tools');
});

function setup(repoFields) {
  const s = fixture();
  const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: CHECK } };
  const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
  const ran = [];
  const run = (cmd) => { ran.push(cmd); return { exit: 0, durationMs: 1, logTail: [], cmd }; };
  return { s, cfg, job: { ...job, commands: COMMANDS }, repo: { ...cfg.repos[0], ...repoFields }, ran, run };
}

test('a submodule repo is prechecked by its narrow check alone, never the superproject whole-workspace command', () => {
  const { s, cfg, job, repo, ran, run } = setup({ submodule: true });
  try {
    assert.equal(precheckJob(cfg, job, repo, { run }), null);
    assert.deepEqual(ran, ['cd rust && cargo check --offline -p rg-graphics -p rg-screens --lib --test player_app']);
  } finally { s.done(); }
});

test('control: a plain repo still runs the narrow check and then the whole-workspace check', () => {
  const { s, cfg, job, repo, ran, run } = setup({});
  try {
    assert.equal(precheckJob(cfg, job, repo, { run }), null);
    assert.equal(ran.length, 2);
    assert.equal(ran[1], CHECK);
  } finally { s.done(); }
});
