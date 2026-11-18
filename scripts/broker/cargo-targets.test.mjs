// A build that selects its targets holds only the tests/ files those targets read (KIT-T1384): a writer may add a test file
// beside a running `cargo test --test x` build; the selected target's own files, its modules and every src/ file stay held.
// Run: node --test scripts/broker/cargo-targets.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { targetSelection, testFileUnread } from './cargo-targets.mjs';
import { buildHoldConflict } from '../../hooks/lib/build-write-hold.mjs';

function crate({ manifest = '[package]\nname = "rdg-world"\n', roots = {} } = {}) {
  const pkg = mkdtempSync(join(tmpdir(), 'ct-'));
  mkdirSync(join(pkg, 'src'), { recursive: true });
  mkdirSync(join(pkg, 'tests', 'common'), { recursive: true });
  writeFileSync(join(pkg, 'Cargo.toml'), manifest);
  writeFileSync(join(pkg, 'src', 'lib.rs'), 'pub fn world() {}\n');
  writeFileSync(join(pkg, 'tests', 'common', 'mod.rs'), 'pub fn fixture() {}\n');
  for (const [name, text] of Object.entries({ 'road_ends_served.rs': 'mod common;\n#[test] fn served() {}\n', ...roots })) writeFileSync(join(pkg, 'tests', name), text);
  return pkg;
}

test('the target selection of a cargo call', () => {
  assert.deepEqual(targetSelection(['test', '-p', 'rdg-world', '--test', 'road_ends_served', '--no-run']), { lib: false, tests: ['road_ends_served'], bins: [], examples: [], benches: [] });
  assert.deepEqual(targetSelection(['test', '--test=a', '--lib']).tests, ['a']);
  assert.equal(targetSelection(['test', '-p', 'rdg-world']), null, 'no selection builds every test target');
  assert.equal(targetSelection(['test', '--test', 'a', '--tests']), null, '--tests widens it again');
  assert.equal(targetSelection(['test', '--', '--test', 'x']), null, 'arguments after -- go to the test binary');
});

test('a new tests/ file beside a --test build is unread; the selected target, its modules and src stay held', () => {
  const pkg = crate();
  const sel = targetSelection(['test', '--test', 'road_ends_served', '--no-run']);
  assert.equal(testFileUnread(join(pkg, 'tests', 'yard_ground.rs'), sel), true);
  assert.equal(testFileUnread(join(pkg, 'tests', 'road_ends_served.rs'), sel), false);
  assert.equal(testFileUnread(join(pkg, 'tests', 'common', 'mod.rs'), sel), false, 'a module the target declares');
  assert.equal(testFileUnread(join(pkg, 'src', 'lib.rs'), sel), false);
  assert.equal(testFileUnread(join(pkg, 'tests', 'yard_ground.rs'), null), false, 'an unselected build reads every test file');
  assert.equal(testFileUnread(join(pkg, 'tests', 'yard_ground.rs'), targetSelection(['test', '--lib'])), true, '--lib builds no test target');
});

test('any doubt keeps the write held', () => {
  const tableCrate = crate({ manifest: '[package]\nname = "w"\n\n[[test]]\nname = "road_ends_served"\npath = "tests/other.rs"\n' });
  assert.equal(testFileUnread(join(tableCrate, 'tests', 'yard_ground.rs'), targetSelection(['test', '--test', 'road_ends_served'])), false, 'a [[test]] table');
  const pathCrate = crate({ roots: { 'road_ends_served.rs': '#[path = "yard_ground.rs"] mod yard;\n' } });
  assert.equal(testFileUnread(join(pathCrate, 'tests', 'yard_ground.rs'), targetSelection(['test', '--test', 'road_ends_served'])), false, '#[path]');
  const modCrate = crate({ roots: { 'road_ends_served.rs': 'mod yard_ground;\n' } });
  assert.equal(testFileUnread(join(modCrate, 'tests', 'yard_ground.rs'), targetSelection(['test', '--test', 'road_ends_served'])), false, 'a mod naming it');
  assert.equal(testFileUnread(join(crate(), 'tests', 'x.rs'), targetSelection(['test', '--test', 'missing'])), false, 'a selected target with no root file');
});

test('the build guard passes the new test file and still refuses the selected target (KIT-T1384)', () => {
  const pkg = crate();
  const hold = { pid: 1, ts: new Date().toISOString(), label: 'x', cwd: pkg, writer: 'S1|builder', scope: [pkg], targets: targetSelection(['test', '--test', 'road_ends_served', '--no-run']) };
  assert.equal(buildHoldConflict({ file: join(pkg, 'tests', 'yard_ground.rs'), writer: 'S1|lawn', holds: [hold] }), null);
  assert.ok(buildHoldConflict({ file: join(pkg, 'tests', 'road_ends_served.rs'), writer: 'S1|lawn', holds: [hold] }), 'negative control: the selected target');
  const older = { ...hold, targets: undefined };
  assert.ok(buildHoldConflict({ file: join(pkg, 'tests', 'yard_ground.rs'), writer: 'S1|lawn', holds: [older] }), 'a hold recorded before targets keeps holding');
});
