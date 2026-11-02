// precheck.mjs on a `cd <submodule dir> && cargo test ...` command (KIT-T841): the check runs in that submodule's own
// workspace, where its test-only dependencies resolve, not in the superproject's, where they do not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { precheckJob } from './precheck.mjs';
import { narrowChecks } from './precheck-scope.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';
const SUBMODULE_TEST = 'cd rapid-game/rust && cargo t -p rg-scatter --lib --test scatter --test legacy';
const OWN_WORKSPACE_CHECK = 'cd rapid-game/rust && cargo check --offline -p rg-scatter --lib --test scatter --test legacy';
const SUBMODULE = { name: 'rapid-game', path: 'rapid-game', main: 'main', remote: 'origin', submodule: true };

test('a superproject command that enters a submodule is checked there, keeping the cd and dropping the superproject features', () => {
  assert.deepEqual(narrowChecks(CHECK, [SUBMODULE_TEST], { submodulePaths: ['rapid-game'] }), [OWN_WORKSPACE_CHECK]);
  assert.deepEqual(
    narrowChecks(CHECK, ['cargo t -p game --lib', SUBMODULE_TEST], { submodulePaths: ['rapid-game'] }),
    ['cargo check --offline -p game --lib --features dirt-empire/tools', OWN_WORKSPACE_CHECK],
    'the superproject command keeps its own check beside it',
  );
  assert.deepEqual(narrowChecks(CHECK, ['cd rapid-game && cargo t -p a --lib'], { submodulePaths: ['rapid-game'] }), ['cd rapid-game && cargo check --offline -p a --lib']);
});

test('control: a cd that is not into a submodule, or a repo with no submodule paths, keeps the old check (cd dropped, features kept)', () => {
  const plain = 'cargo check --offline -p rg-scatter --lib --test scatter --test legacy --features dirt-empire/tools';
  assert.deepEqual(narrowChecks(CHECK, [SUBMODULE_TEST]), [plain]);
  assert.deepEqual(narrowChecks(CHECK, ['cd tools/rust && cargo t -p rg-scatter --lib --test scatter --test legacy'], { submodulePaths: ['rapid-game'] }), [plain]);
  assert.deepEqual(narrowChecks(CHECK, ['cd rapid-games/rust && cargo t -p a --lib'], { submodulePaths: ['rapid-game'] }), ['cargo check --offline -p a --lib --features dirt-empire/tools'], 'a path that only shares the prefix text');
});

test('on the submodule repo a cd written from the superproject root is read from the submodule root', () => {
  const opts = { submodule: true, repoPath: 'rapid-game' };
  assert.deepEqual(narrowChecks(CHECK, [SUBMODULE_TEST], opts), ['cd rust && cargo check --offline -p rg-scatter --lib --test scatter --test legacy']);
  assert.deepEqual(narrowChecks(CHECK, ['cd rapid-game && cargo t -p a --lib'], opts), ['cargo check --offline -p a --lib']);
  assert.deepEqual(narrowChecks(CHECK, ['cd rust && cargo t -p a --lib'], opts), ['cd rust && cargo check --offline -p a --lib'], 'already from the submodule root');
});

function prechecked(commands, runFor) {
  const s = fixture();
  const ran = [];
  try {
    const base = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: CHECK, fullCheck: CHECK } };
    const cfg = { ...base, repos: [...base.repos, SUBMODULE] };
    const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
    const run = (cmd, opts) => { ran.push(cmd); return runFor(cmd, opts); };
    return { result: precheckJob(cfg, { ...job, commands }, cfg.repos[0], { run }), ran };
  } finally { s.done(); }
}

const green = (cmd) => ({ exit: 0, durationMs: 1, logTail: [], cmd });

test('a linked job on the superproject checks the submodule command in the submodule workspace, then the superproject whole', () => {
  const { result, ran } = prechecked([SUBMODULE_TEST], green);
  assert.equal(result, null);
  assert.deepEqual(ran, [OWN_WORKSPACE_CHECK, CHECK]);
});

test('negative control: a rustc error from the submodule workspace check (a dev-dependency missing there too) still rejects the job', () => {
  const missing = (cmd, opts) => {
    writeFileSync(opts.logPath, "error[E0433]: failed to resolve: use of undeclared crate or module `serde_json`\n --> rapid-game/rust/crates/rg-scatter/tests/scatter/tables.rs:3:5\n");
    return { exit: 101, durationMs: 1, logTail: [], cmd };
  };
  const { result, ran } = prechecked([SUBMODULE_TEST], missing);
  assert.equal(result.status, 'failed');
  assert.match(result.message, /compile error in the patch \(cd rapid-game\/rust && cargo check/);
  assert.deepEqual(ran, [OWN_WORKSPACE_CHECK], 'the job never reaches the whole-workspace stage');
});
