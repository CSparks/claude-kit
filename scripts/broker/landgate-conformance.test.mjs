// landgate-conformance.test.mjs — `affected.conformance` is the framework conformance test: it joins every landing that touches
// Rust source or a manifest (mapped or not), and nothing else (KIT-T690).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { landGate } from './landgate.mjs';
import { fixture, g } from './patchkit.mjs';

const CONFORMANCE = 'cargo t -p app --test conformance';
const FILES = { 'crates/app/Cargo.toml': '[package]\nname = "app"\n', 'crates/app/src/camera.rs': 'x\n', 'crates/app/src/lib.rs': 'pub mod camera;\n', 'crates/app/tests/alpha.rs': 'use app::camera;\n' };

function gated(conformance) {
  const s = fixture();
  for (const [p, t] of Object.entries(FILES)) { mkdirSync(join(s.root, p, '..'), { recursive: true }); writeFileSync(join(s.root, p), t); }
  g(['add', '-A', 'crates'], s.root);
  g(['commit', '-m', 'crate'], s.root);
  const affected = { check: 'cargo check --workspace --all-targets', test: 'cargo t', ...(conformance ? { conformance } : {}) };
  const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: ['cargo t'], land_gate: 'affected', affected });
  const run = (paths) => landGate(cfg, s.root, { commands: [] }, new Map(paths.map((p) => [p, { text: 'changed\n' }])));
  return { s, run };
}

test('a landing that touches a mapped Rust file runs the conformance test last, once', () => {
  const t = gated(CONFORMANCE);
  try {
    const { commands } = t.run(['crates/app/src/camera.rs']);
    assert.equal(commands.at(-1), CONFORMANCE);
    assert.equal(commands.filter((c) => c === CONFORMANCE).length, 1);
  } finally { t.s.done(); }
});

test('an unmapped Rust path still runs the job commands plus the conformance test', () => {
  const t = gated(CONFORMANCE);
  try {
    const out = t.run(['elsewhere/new_module.rs']);
    assert.deepEqual(out.commands, ['cargo t', CONFORMANCE]);
  } finally { t.s.done(); }
});

test('negative controls: no conformance configured, or a change with no Rust source or manifest, adds nothing', () => {
  const off = gated(null);
  const on = gated(CONFORMANCE);
  try {
    assert.ok(!off.run(['crates/app/src/camera.rs']).commands.includes(CONFORMANCE), 'unset');
    assert.equal(off.run(['elsewhere/new_module.rs']), null, 'unset: an unmapped path falls back to the job commands as before');
    const docs = on.run(['crates/app/README.md']);
    assert.ok(!docs || !docs.commands.includes(CONFORMANCE), 'a docs change');
  } finally { off.s.done(); on.s.done(); }
});
