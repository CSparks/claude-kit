// train-blame.test.mjs — tracing a train's red command to one member (KIT-T482 item 1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blame } from './train-blame.mjs';

const members = [
  { id: 'A', touched: ['crates/game/src/track/lanes/height.rs'], commands: ['cargo check --workspace', 'cargo test -p game --lib --test lanes'] },
  { id: 'B', touched: ['crates/game/src/venue/ground.rs', 'crates/game/tests/venue_budget.rs'], commands: ['cargo check --workspace', 'cargo test -p game --lib --test venue_budget'] },
  { id: 'C', touched: ['crates/ui/src/menu.rs'], commands: ['cargo check --workspace', 'cargo test -p ui --lib'] },
];
const all = ['A', 'B', 'C'];
const one = (verdict) => [...verdict.blamed.entries()].map(([id, why]) => [id, why.length]);

test('a compile error goes to the member that touched the file, absolute or workspace-relative', () => {
  const v = blame({ cmd: 'cargo check', exit: 101, owners: all, errors: { 'D:/dev/x/crates/game/src/venue/ground.rs': ['e'], 'crates/ui/src/menu.rs': ['e'] }, failed: [] }, members);
  assert.deepEqual(one(v), [['B', 1], ['C', 1]]);
  assert.deepEqual(v.ambiguous, []);
});

test('negative: a compile error in a file no member touched is ambiguous', () => {
  const v = blame({ cmd: 'cargo check', exit: 101, owners: all, errors: { 'crates/game/src/lib.rs': ['e'], '(unlocated)': ['e'] }, failed: [] }, members);
  assert.equal(v.blamed.size, 0);
  assert.equal(v.ambiguous.length, 2);
});

test('a failed nextest test goes to the only member selecting its target, else to the one that touched the test file', () => {
  const ui = blame({ cmd: 'cargo nextest run', exit: 100, owners: all, errors: {}, failed: [{ binary: 'ui', test: 'menu::fits' }] }, members);
  assert.deepEqual(one(ui), [['C', 1]]);
  const budget = blame({ cmd: 'cargo nextest run', exit: 100, owners: all, errors: {}, failed: [{ binary: 'game::venue_budget', test: 'fits' }] }, members);
  assert.deepEqual(one(budget), [['B', 1]]);
  assert.match(budget.blamed.get('B')[0], /only member selecting --test venue_budget/);
});

test('a lib unit test shared by two members goes to the one that touched its module', () => {
  const v = blame({ cmd: 'cargo nextest run', exit: 100, owners: all, errors: {}, failed: [{ binary: 'game', test: 'track::lanes::height::tests::flat' }] }, members);
  assert.deepEqual(one(v), [['A', 1]]);
  assert.match(v.blamed.get('A')[0], /touched its module/);
});

test('negative: a lib test whose module nobody touched stays ambiguous between the members selecting --lib', () => {
  const v = blame({ cmd: 'cargo nextest run', exit: 100, owners: all, errors: {}, failed: [{ binary: 'game', test: 'physics::tests::gravity' }] }, members);
  assert.equal(v.blamed.size, 0);
  assert.match(v.ambiguous[0], /could belong to A, B/);
});

test('only the caused failures count once attribution found foreign ones', () => {
  const v = blame({ cmd: 'cargo nextest run', exit: 100, owners: all, errors: {}, caused: ['fits'], failed: [{ binary: 'ui', test: 'menu::fits' }, { binary: 'game::venue_budget', test: 'fits' }] }, members);
  assert.deepEqual(one(v), [['B', 1]]);
});

test('a command only one member asked for blames that member whatever failed', () => {
  const v = blame({ cmd: 'cargo test -p ui --lib', exit: 101, owners: ['C'], errors: {}, failed: [] }, members);
  assert.deepEqual(one(v), [['C', 1]]);
  const shared = blame({ cmd: 'cargo check --workspace', exit: 1, owners: all, errors: {}, failed: [] }, members);
  assert.equal(shared.blamed.size, 0);
  assert.match(shared.ambiguous[0], /no located error/);
});
