// precheck-scope.mjs — the narrow check is built from the packages and test binaries the job's own cargo commands name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrowCheck } from './precheck-scope.mjs';

const CHECK = 'cargo check --offline --workspace --all-targets --features dirt-empire/tools';

test('a named package and test binary: the library and that binary, features kept after the scope', () => {
  assert.equal(narrowCheck(CHECK, ['cargo t -p dirt-empire --test app layer_dag --no-fail-fast -j 15 -- --nocapture']),
    'cargo check --offline -p dirt-empire --lib --test app --features dirt-empire/tools');
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
