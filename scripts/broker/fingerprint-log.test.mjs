// fingerprint-log.test.mjs — cargo's dirty reasons parsed out of real fingerprint log lines (KIT-Q005 lever 3, KIT-T772).
// The fixtures are verbatim `CARGO_LOG=cargo::core::compiler::fingerprint=info cargo build` stderr (cargo 1.94.1) of a
// two-crate throwaway workspace: a touched dependency, a changed RUSTFLAGS, and a cold target dir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FINGERPRINT_ENV, harvestDirty, parseFingerprint } from './fingerprint-log.mjs';

const fixture = (name) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8');
const byCrate = (reasons) => Object.fromEntries(reasons.map((r) => [`${r.crate}`, r.reason]));

test('a touched dependency: the dependency names its changed source file, the dependent says it rebuilt for a dependency', () => {
  const { reasons } = parseFingerprint(fixture('fingerprint-changed.log'));
  assert.deepEqual(byCrate(reasons), { depc: 'source changed: dep/src/lib.rs', probe: 'dependency rebuilt' });
});

test('changed RUSTFLAGS is named as such, and the dependency whose artifact key moved with it reads as cold', () => {
  const { reasons } = parseFingerprint(fixture('fingerprint-rustflags.log'));
  assert.deepEqual(byCrate(reasons), { probe: 'rustflags changed', depc: 'cold: no earlier fingerprint' });
});

test('a cold target dir reads as no earlier fingerprint for each crate, and the error continuation lines go too', () => {
  const { reasons, text } = parseFingerprint(fixture('fingerprint-cold.log'));
  assert.deepEqual(byCrate(reasons), { depc: 'cold: no earlier fingerprint', probe: 'cold: no earlier fingerprint' });
  assert.doesNotMatch(text, /Caused by|system cannot find|fingerprint/);
  assert.match(text, /Compiling depc/);
  assert.match(text, /Finished/);
});

test('the raw fingerprint lines are dropped and every other line is kept', () => {
  const log = fixture('fingerprint-changed.log');
  const { text } = parseFingerprint(log);
  const others = log.split('\n').filter((l) => !l.includes('cargo::core::compiler::fingerprint'));
  assert.deepEqual(text.split('\n'), others);
  assert.ok(text.length < log.length / 4, 'volume bounded: only the parsed reasons stay');
});

test('harvestDirty rewrites the log, sets dirty and re-reads the tail; a log with no fingerprint lines is left alone', () => {
  const file = join(tmpdir(), `fingerprint-log-${process.pid}.log`);
  writeFileSync(file, fixture('fingerprint-changed.log'));
  const out = harvestDirty({ exit: 0, logTail: ['stale'] }, file, (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean));
  assert.equal(out.dirty.length, 2);
  assert.doesNotMatch(readFileSync(file, 'utf8'), /fingerprint/);
  assert.ok(out.logTail.every((l) => !/fingerprint/.test(l)));
  writeFileSync(file, '   Compiling x v0.1.0\n');
  const same = { exit: 0, logTail: ['x'] };
  assert.equal(harvestDirty(same, file, () => []), same);
});

test('the environment asks cargo for the fingerprint module only', () => {
  assert.equal(FINGERPRINT_ENV.CARGO_LOG, 'cargo::core::compiler::fingerprint=info');
});
