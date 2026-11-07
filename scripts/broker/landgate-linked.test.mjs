// landgate-linked.test.mjs — a landing in a superproject that touches a submodule's crates runs the job's own tests, the
// check and the conformance test, not the whole test run of every crate depending on them in the submodule's own workspace
// (KIT-T860): that command unifies features apart from the job's own command and recompiles the framework cold.
// The superproject's dependents and a framework-own landing keep the KIT-D110 dependents run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { landGate } from './landgate.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const lock = (rows) => rows.map(([name, deps = []]) => `[[package]]\nname = "${name}"\nversion = "0.1.0"\n${deps.length ? `dependencies = [\n${deps.map((d) => ` "${d}",\n`).join('')}]\n` : ''}`).join('\n');
const crate = (dir, name) => ({ [`${dir}/Cargo.toml`]: `[package]\nname = "${name}"\n`, [`${dir}/src/lib.rs`]: '' });

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["game", "racer"]\nexclude = ["fw"]\n',
  'Cargo.lock': lock([['fw-base'], ['fw-editor', ['fw-base']], ['fw-tool', ['fw-editor']], ['racer', ['game']], ['game', ['fw-base']]]),
  ...crate('game', 'game'),
  ...crate('racer', 'racer'),
  'fw/rust/Cargo.toml': '[workspace]\nmembers = ["base", "editor", "tool"]\n',
  'fw/rust/Cargo.lock': lock([['fw-base'], ['fw-editor', ['fw-base']], ['fw-tool', ['fw-editor']]]),
  ...crate('fw/rust/base', 'fw-base'),
  ...crate('fw/rust/editor', 'fw-editor'),
  ...crate('fw/rust/tool', 'fw-tool'),
};

function tree() {
  const dir = tempDir('landgate-linked-');
  for (const [p, text] of Object.entries(LAYOUT)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  }
  return dir;
}

const cfg = {
  landGate: 'affected',
  suite: ['cargo test'],
  repos: [{ name: 'game', path: '.', submodule: false }, { name: 'fw', path: 'fw', submodule: true }],
  affected: { check: 'CHECK', test: 'cargo test', match: 'word', mandatory: false, dependents: true, conformance: 'CONFORMANCE' },
};
const files = (...paths) => new Map(paths.map((p) => [p, { text: 'x' }]));
const FRAMEWORK_TEST = 'cd fw/rust && cargo test -p fw-base --test unit';
const GAME_TEST = 'cargo test -p game --test bike';

test('a landing that touches only the submodule runs the check, the job tests and the conformance test', () => {
  const dir = tree();
  try {
    const gate = landGate(cfg, dir, { commands: [FRAMEWORK_TEST] }, files('fw/rust/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', FRAMEWORK_TEST, 'CONFORMANCE']);
    assert.deepEqual(gate.selection.deferredDependents.sort(), ['fw-editor', 'fw-tool']);
  } finally { cleanup(dir); }
});

test('a linked landing keeps the superproject dependents of its own crate and defers the submodule ones', () => {
  const dir = tree();
  try {
    const gate = landGate(cfg, dir, { commands: [GAME_TEST, FRAMEWORK_TEST] }, files('game/src/lib.rs', 'fw/rust/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', GAME_TEST, FRAMEWORK_TEST, 'cargo test -p racer', 'CONFORMANCE']);
    assert.deepEqual(gate.selection.deferredDependents.sort(), ['fw-editor', 'fw-tool']);
  } finally { cleanup(dir); }
});

test('a landing with no job tests maps the submodule paths and still defers the submodule dependents', () => {
  const dir = tree();
  try {
    const gate = landGate(cfg, dir, { commands: [] }, files('fw/rust/base/src/lib.rs'));
    assert.ok(!gate.commands.some((c) => c.includes('fw-editor')), gate.commands.join(' | '));
    assert.deepEqual(gate.selection.deferredDependents.sort(), ['fw-editor', 'fw-tool']);
  } finally { cleanup(dir); }
});

test('control: a framework-own landing (cwd inside the submodule) keeps its dependents run', () => {
  const dir = tree();
  try {
    const own = ['cd rust && cargo test -p fw-base --test unit'];
    const gate = landGate(cfg, join(dir, 'fw'), { commands: own }, files('rust/base/src/lib.rs'));
    assert.deepEqual(gate.commands, ['CHECK', ...own, 'cd rust && cargo test -p fw-editor -p fw-tool', 'CONFORMANCE']);
  } finally { cleanup(dir); }
});
