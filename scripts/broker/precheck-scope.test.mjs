// precheck-scope.mjs — the narrow check is built from the packages and test binaries the job's own cargo commands name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrowChecks } from './precheck-scope.mjs';

const narrowCheck = (...args) => narrowChecks(...args)[0] ?? null;

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';

test('a named package and test binary: the library and that binary, features kept after the scope', () => {
  assert.equal(narrowCheck(CHECK, ['cargo t -p dirt-empire --test app layer_dag --no-fail-fast -j 15 -- --nocapture']),
    'cargo check --offline -p dirt-empire --lib --test app --features dirt-empire/tools');
});

test('two commands naming different test binaries, one with a test filter and passthrough args, check the lib and both binaries (KIT-T728)', () => {
  assert.equal(
    narrowCheck(CHECK, ['cargo t -p dirt-empire --test track grid_circuit_golden', 'cargo t -p dirt-empire --test free_ride free_ride_shadow_casters -- --nocapture']),
    'cargo check --offline -p dirt-empire --lib --test track --test free_ride --features dirt-empire/tools');
});

test('a package with no named target checks all its tests; several commands union their packages and binaries', () => {
  assert.equal(narrowCheck('cargo check --workspace --all-targets', ['cargo test --offline -p game']), 'cargo check -p game --lib --tests');
  assert.equal(narrowCheck('cargo check --workspace', ['cargo t -p a --test x', 'cargo t -p b --test y', 'cargo t -p a --test x']), 'cargo check -p a -p b --lib --test x --test y');
  assert.equal(narrowCheck('cargo check --workspace', ['cd rust && cargo nextest run -p a --lib']), 'cargo check -p a --lib');
});

test('negative: commands that name no package or are not cargo tests give no narrow check', () => {
  assert.equal(narrowCheck(CHECK, ['cargo t --test x']), null, 'workspace-wide');
  assert.equal(narrowCheck(CHECK, ['cargo clippy -p game', 'node tools/x.mjs']), null);
  assert.equal(narrowCheck(CHECK, []), null);
});

const FRAMEWORK_TEST = 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test shader_compile';
const FRAMEWORK_CHECK = 'cargo check --offline --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --lib --test shader_compile';

test('a --manifest-path command is checked in its own workspace, apart from the repo-level commands (KIT-T829)', () => {
  assert.deepEqual(narrowChecks(CHECK, [FRAMEWORK_TEST]), [FRAMEWORK_CHECK]);
  assert.deepEqual(narrowChecks(CHECK, ['cargo t -p dirt-empire --test app', FRAMEWORK_TEST, 'cargo t --manifest-path=rapid-game/rust/Cargo.toml -p rg-testkit --lib']), [
    'cargo check --offline -p dirt-empire --lib --test app --features dirt-empire/tools',
    'cargo check --offline --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit -p rg-testkit --lib --test shader_compile',
  ]);
});

test('negative control: the manifest stays on its check, superproject features stay off it, and a manifest naming no package checks nothing', () => {
  const [check] = narrowChecks(CHECK, [FRAMEWORK_TEST]);
  assert.ok(check.includes('--manifest-path rapid-game/rust/Cargo.toml'));
  assert.ok(!check.includes('--features'));
  assert.deepEqual(narrowChecks(CHECK, ['cargo test --manifest-path rapid-game/rust/Cargo.toml --test x']), []);
});
