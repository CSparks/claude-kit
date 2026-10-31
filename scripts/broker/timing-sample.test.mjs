// timing-sample.test.mjs — a finished job's wall time splits into queue, compile, test and gate, per crate and per
// test, and the work the change did not need is measured directly (KIT-D121).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sampleOf, samplesFromResults } from './timing-sample.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const S = 1000;
const LOCK = [
  ['base', []], ['mid', ['base']], ['top', ['mid']], ['lone', []], ['serde', []],
].map(([name, deps]) => `[[package]]\nname = "${name}"\nversion = "0.1.0"\n${name === 'serde' ? 'source = "registry+https://x"\n' : ''}${deps.length ? `dependencies = [\n ${deps.map((d) => `"${d}"`).join(', ')},\n]\n` : ''}`).join('\n');

function workspace() {
  const dir = tempDir('timing-ws-');
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  put('Cargo.lock', LOCK);
  for (const c of ['base', 'mid', 'top', 'lone']) { put(`crates/${c}/Cargo.toml`, `[package]\nname = "${c}"\n`); put(`crates/${c}/src/lib.rs`, ''); }
  return { dir, put };
}

const cmd = (dir, put, name, cmdline, { compiled = [], finished = 0, wait = 0, ran = 10 * S } = {}) => {
  const log = join(dir, `${name}.log`);
  put(`${name}.log`, [...compiled.map((c) => `   Compiling ${c} v0.1.0 (/x/${c})`), ...(finished ? [`    Finished \`test\` profile in ${finished}s`] : [])].join('\n'));
  return { cmd: cmdline, exit: 0, durationMs: ran, slotWaitMs: wait, log };
};

const ids = (sample, kind) => Object.fromEntries(sample.entries.filter((e) => e.kind === kind).map((e) => [e.key, Math.round(e.ms)]));

test('a job splits into queue, compile, test and gate, and into crate and test entries', () => {
  const { dir, put } = workspace();
  try {
    const result = { id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' crates/base/src/lib.rs | 2 +-', timings: [{ phase: 'apply', ms: 2 * S }, { phase: 'gate', ms: 5 * S }, { phase: 'run', ms: 60 * S }], commands: [cmd(dir, put, 'c0', 'cargo t -p mid --test api', { compiled: ['base', 'mid'], finished: 8, wait: 20 * S, ran: 30 * S })] };
    const s = sampleOf([result], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(ids(s, 'phase'), { queue: 20 * S, compile: 8 * S, test: 22 * S, apply: 2 * S, gate: 5 * S, 'run-idle': 10 * S });
    assert.deepEqual(ids(s, 'crate'), { mid: 50 * S });
    assert.deepEqual(ids(s, 'test'), { 'mid --test api': 50 * S });
  } finally { cleanup(dir); }
});

test('waste: a crate compiled that the change neither touched nor reaches, a test run beyond the change, and cache hits and misses', () => {
  const { dir, put } = workspace();
  try {
    const commands = [
      cmd(dir, put, 'c0', 'cargo t -p mid --lib', { compiled: ['base', 'mid', 'lone', 'serde'], finished: 8 }),
      cmd(dir, put, 'c1', 'cargo t -p top --lib'),
      cmd(dir, put, 'c2', 'cargo t -p lone --lib', { wait: 4 * S, ran: 6 * S }),
    ];
    const s = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' crates/base/src/lib.rs | 2 +-', commands }], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(ids(s, 'waste'), { 'rebuild lone': 2 * S, 'rebuild serde': 2 * S, 'scope lone --lib': 10 * S });
    assert.deepEqual(s.cache, { hits: 2, misses: 1 });
  } finally { cleanup(dir); }
});

test('negative controls: a touched crate and its dependents are not waste, and an unplaceable diff yields no waste claim', () => {
  const { dir, put } = workspace();
  try {
    const commands = [cmd(dir, put, 'c0', 'cargo t -p top --lib', { compiled: ['base', 'mid', 'top'], finished: 9 })];
    const placed = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' crates/base/src/lib.rs | 2 +-', commands }], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(ids(placed, 'waste'), {});
    const unplaced = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' elsewhere/src/lib.rs | 2 +-', commands: [cmd(dir, put, 'c1', 'cargo t -p mid --lib', { compiled: ['lone'], finished: 4 })] }], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(ids(unplaced, 'waste'), {});
  } finally { cleanup(dir); }
});

test('a doc-only change makes every crate a command compiled beyond its own -p crate waste', () => {
  const { dir, put } = workspace();
  try {
    const commands = [cmd(dir, put, 'c0', 'cargo t -p mid --lib', { compiled: ['base', 'mid'], finished: 6 })];
    const s = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' docs/a.md | 2 +-', commands }], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(ids(s, 'waste'), { 'rebuild base': 3 * S });
  } finally { cleanup(dir); }
});

test('the members of one train are one sample and shared commands count once', () => {
  const train = { id: 'train-x', members: ['j-a', 'j-b'] };
  const shared = { cmd: 'cargo t -p mid --lib', durationMs: 4 * S, slotWaitMs: S };
  const a = { id: `j-${(1000).toString(36)}-a`, finishedAt: '1970-01-01T00:00:03Z', train, commands: [shared], timings: [] };
  const b = { id: `j-${(2000).toString(36)}-b`, finishedAt: '1970-01-01T00:00:03Z', train, commands: [shared], timings: [] };
  const samples = samplesFromResults([a, b], { project: 'p', lane: 'root' });
  assert.equal(samples.length, 1);
  assert.equal(samples[0].jobs, 2);
  assert.equal(samples[0].turnaroundMs, 1500);
  assert.deepEqual(ids(samples[0], 'crate'), { mid: 5 * S });
});

test('a nested workspace\'s crate reaches the project crate that depends on it through the project lock, and base movement counts like the diff', () => {
  const dir = tempDir('timing-nested-');
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  try {
    put('Cargo.lock', '[[package]]\nname = "game"\nversion = "0.1.0"\ndependencies = [\n "phys",\n]\n\n[[package]]\nname = "phys"\nversion = "0.1.0"\n');
    put('fw/rust/Cargo.lock', '[[package]]\nname = "phys"\nversion = "0.1.0"\n');
    put('fw/rust/phys/Cargo.toml', '[package]\nname = "phys"\n');
    put('fw/rust/phys/src/lib.rs', '');
    put('crates/game/Cargo.toml', '[package]\nname = "game"\n');
    const commands = [cmd(dir, put, 'c0', 'cargo t -p game --lib', { compiled: ['phys', 'game', 'lone'], finished: 9 })];
    const ctx = { project: 'p', lane: 'root', bases: [dir] };
    const own = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' fw/rust/phys/src/lib.rs | 1 +', commands }], ctx);
    assert.deepEqual(ids(own, 'waste'), { 'rebuild lone': 3 * S });
    const landed = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' docs/a.md | 1 +', commands }], { ...ctx, moved: ['fw/rust/phys/src/lib.rs'] });
    assert.deepEqual(ids(landed, 'waste'), { 'rebuild lone': 3 * S }, 'phys rebuilt because the pin moved: not waste');
    const unmoved = sampleOf([{ id: 'j-a', finishedAt: '2026-10-30T10:00:00Z', diffStat: ' docs/a.md | 1 +', commands }], ctx);
    assert.deepEqual(ids(unmoved, 'waste'), { 'rebuild phys': 3 * S, 'rebuild lone': 3 * S }, 'control: with nothing moved, phys is a rebuild nothing asked for');
  } finally { cleanup(dir); }
});
