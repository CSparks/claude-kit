// precheck.mjs on a job whose --test names a nested workspace by --manifest-path (KIT-T829): the framework crate is checked
// from its own manifest, so its dev-dependencies resolve, and the superproject's whole-workspace check still runs after it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precheckJob } from './precheck.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';
const COMMANDS = ['cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test shader_compile'];

function ranFor(commands) {
  const s = fixture();
  const ran = [];
  try {
    const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: CHECK, fullCheck: CHECK } };
    const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
    const run = (cmd) => { ran.push(cmd); return { exit: 0, durationMs: 1, logTail: [], cmd }; };
    return { result: precheckJob(cfg, { ...job, commands }, cfg.repos[0], { run }), ran };
  } finally { s.done(); }
}

test('a framework integration test is checked from its own manifest, then the repo workspace is checked whole', () => {
  const { result, ran } = ranFor(COMMANDS);
  assert.equal(result, null);
  assert.deepEqual(ran, ['cargo check --offline --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --lib --test shader_compile', CHECK]);
});

test('negative control: no check folds the framework package into the repo workspace without its manifest', () => {
  const { ran } = ranFor(COMMANDS);
  assert.ok(ran.every((cmd) => !cmd.includes('-p rg-shader-kit') || cmd.includes('--manifest-path rapid-game/rust/Cargo.toml')));
});
