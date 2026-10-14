// landgate.test.mjs — with `land_gate: affected` a landing runs the check and the mapped tests,
// not the full suite, and its commit carries the Broker-Gate trailer (KIT-T472).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { isSuiteShaped } from './landgate.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

test('suite-shaped: suite commands modulo -j/--no-fail-fast and unfiltered cargo test; targeted runs are not', () => {
  const suite = ['cargo test --offline -p game', 'cargo run --release --bin probe'];
  assert.ok(isSuiteShaped('cargo test --offline -p game --no-fail-fast -j 3', suite));
  assert.ok(isSuiteShaped('cargo run --release --bin probe -j 3', suite));
  assert.ok(isSuiteShaped('cargo t -p other', suite), 'unfiltered test of any package');
  assert.ok(isSuiteShaped('cargo test -p x -- --nocapture', suite));
  assert.ok(!isSuiteShaped('cargo test -p game --test controls', suite));
  assert.ok(!isSuiteShaped('cargo test -p game --lib racing', suite));
  assert.ok(!isSuiteShaped('cargo test -p game -- held_steer', suite), 'a libtest name filter');
  assert.ok(!isSuiteShaped('cargo run --release --bin probe -- --smoke', suite));
  assert.ok(!isSuiteShaped('cargo clippy --all-targets', suite));
});

// A fixture repo holding one crate, whose "cargo" commands log what they were asked to run.
const crateFixture = (gate) => {
  const s = fixture();
  const dir = tempDir('landgate-log-');
  const log = join(dir, 'ran').replace(/\\/g, '/');
  const rec = (tag) => `node -e "require('fs').appendFileSync('${log}','${tag} '+process.argv.slice(1).join(' ')+'\\n')" --`;
  const files = { 'crates/app/Cargo.toml': '[package]\nname = "app"\n', 'crates/app/src/camera.rs': 'x\n', 'crates/app/tests/alpha.rs': 'use app::camera;\n', 'crates/app/tests/beta.rs': '\n' };
  for (const [p, t] of Object.entries(files)) { mkdirSync(join(s.root, p, '..'), { recursive: true }); writeFileSync(join(s.root, p), t); }
  g(['add', '-A', 'crates'], s.root);
  g(['commit', '-m', 'crate'], s.root);
  g(['push', 'origin', 'main'], s.root);
  const suiteCmd = rec('SUITE');
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [suiteCmd], land_gate: gate, affected: { check: rec('CHECK'), test: rec('TEST') } });
  const ran = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim()) : []);
  const land = (envelope, commands) => {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'camera', land: true }, envelope);
    writeJob(s.cfg, { ...job, commands });
    processOnce(s.cfg);
    return readResult(s.cfg, job.id);
  };
  return { s, ran, land, suiteCmd, done: () => { cleanup(dir); s.done(); } };
};

const CAMERA = '*** edit crates/app/src/camera.rs\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE\n';

test('an affected landing runs the check and the mapped tests, drops the suite, and cites the gate in the commit', () => {
  const t = crateFixture('affected');
  try {
    const r = t.land(CAMERA, [t.suiteCmd]);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(t.ran(), ['CHECK', 'TEST -p app --lib --test alpha']);
    assert.deepEqual(r.selection.dropped, [t.suiteCmd]);
    assert.deepEqual(r.selection.reasons, [{ path: 'crates/app/src/camera.rs', crate: 'app', picks: ['--lib', '--test alpha'] }]);
    const body = g(['log', '-1', '--pretty=%B'], t.s.root);
    assert.match(body, /^camera \(implements T-1\)\n\nBroker-Gate: j-\S+ 2\/2 commands green; affected gate, full suite on the cadence/);
  } finally { t.done(); }
});

test('negative: land_gate full runs the job commands as given, and an unmapped .rs falls back to them', () => {
  const full = crateFixture('full');
  try {
    assert.equal(full.land(CAMERA, [full.suiteCmd]).status, 'landed');
    assert.deepEqual(full.ran(), ['SUITE']);
  } finally { full.done(); }
  const stray = crateFixture('affected');
  try {
    const r = stray.land('*** write tools/stray.rs\nfn main() {}\n', [stray.suiteCmd]);
    assert.equal(r.status, 'landed');
    assert.deepEqual(stray.ran(), ['SUITE']);
    assert.equal(r.selection, null);
  } finally { stray.done(); }
});
