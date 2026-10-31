// timing-dirty.test.mjs — cargo's dirty reason reaches the timing record of each unneeded rebuild and `broker blockers`
// shows the top reasons per crate (KIT-Q005 lever 3, KIT-T772). The reasons come from a real fingerprint log fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFingerprint } from './fingerprint-log.mjs';
import { dirtyLines } from './timing-dirty.mjs';
import { profile } from './timing-profile.mjs';
import { sampleOf } from './timing-sample.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const S = 1000;
const NOW = Date.parse('2026-10-30T12:00:00Z');
const LOCK = [['core', []], ['depc', []], ['probe', ['depc']]]
  .map(([name, deps]) => `[[package]]\nname = "${name}"\nversion = "0.1.0"\n${deps.length ? `dependencies = [\n ${deps.map((d) => `"${d}"`).join(', ')},\n]\n` : ''}`).join('\n');
const fixture = (name) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name), 'utf8');

function workspace() {
  const dir = tempDir('timing-dirty-');
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  put('Cargo.lock', LOCK);
  for (const c of ['core', 'depc', 'probe']) put(`crates/${c}/Cargo.toml`, `[package]\nname = "${c}"\n`);
  return { dir, put };
}

const compileCommand = (dir, put, dirty) => {
  put('c0.log', '   Compiling depc v0.1.0 (/x/depc)\n   Compiling probe v0.1.0 (/x/probe)\n    Finished `test` profile in 8s\n');
  return { cmd: 'cargo t -p core --lib', exit: 0, durationMs: 30 * S, log: join(dir, 'c0.log'), ...(dirty ? { dirty } : {}) };
};

const sampleWith = (dirty) => {
  const { dir, put } = workspace();
  try {
    const result = { id: 'j-a', finishedAt: new Date(NOW - 60 * S).toISOString(), diffStat: ' crates/core/src/lib.rs | 2 +-', commands: [compileCommand(dir, put, dirty)] };
    return sampleOf([result], { project: 'p', lane: 'root', bases: [dir] });
  } finally { cleanup(dir); }
};

const dirtyEntries = (sample) => Object.fromEntries(sample.entries.filter((e) => e.kind === 'dirty').map((e) => [e.key, e.ms]));

test('each unneeded rebuild carries the reason cargo gave, with the rebuild\'s cost', () => {
  const { reasons } = parseFingerprint(fixture('fingerprint-changed.log'));
  const sample = sampleWith(reasons);
  assert.deepEqual(dirtyEntries(sample), { 'depc: source changed: dep/src/lib.rs': 4 * S, 'probe: dependency rebuilt': 4 * S });
});

test('a rebuilt crate cargo gave no reason for is recorded as not reported; a command run without the capture records none', () => {
  assert.deepEqual(dirtyEntries(sampleWith([{ crate: 'depc', reason: 'cold: no earlier fingerprint', count: 1 }])), { 'depc: cold: no earlier fingerprint': 4 * S, 'probe: not reported by cargo': 4 * S });
  assert.deepEqual(dirtyEntries(sampleWith(null)), {});
});

test('the profile keeps dirty rows out of the ticketed top, and the blockers lines show the top reasons per crate', () => {
  const { reasons } = parseFingerprint(fixture('fingerprint-changed.log'));
  const p = profile([sampleWith(reasons)], { now: NOW, topN: 9 });
  assert.ok(!p.top.some((r) => r.kind === 'dirty'));
  const lines = dirtyLines(p.byKind.dirty);
  assert.match(lines[0], /why crates rebuilt without need/);
  assert.ok(lines.some((l) => /p\/root depc: .*source changed: dep\/src\/lib\.rs/.test(l)));
  assert.ok(lines.some((l) => /p\/root probe: .*dependency rebuilt/.test(l)));
});

test('negative control: no dirty rows print nothing, and a crate keeps at most the requested number of reasons', () => {
  assert.deepEqual(dirtyLines([]), []);
  const rows = ['a', 'b', 'c', 'd'].map((r, i) => ({ project: 'p', lane: 'root', key: `x: reason ${r}`, ms: (4 - i) * 60000 }));
  const [, line] = dirtyLines(rows, { crates: 1, reasons: 2 });
  assert.match(line, /reason a 4\.0 min; reason b 3\.0 min$/);
});
