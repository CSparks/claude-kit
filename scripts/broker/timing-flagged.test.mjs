// timing-flagged.test.mjs — test commands for crates the change does not reach are flagged in the job result and
// recorded by outcome in the timing profile (KIT-Q005 lever 2 option A, KIT-T771). Nothing is skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resultSummary } from './command-summary.mjs';
import { profile } from './timing-profile.mjs';
import { outsideReachOf } from './timing-reach.mjs';
import { sampleOf } from './timing-sample.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const S = 1000;
const NOW = Date.parse('2026-10-30T12:00:00Z');
const LOCK = [['base', []], ['mid', ['base']], ['lone', []], ['other', []]]
  .map(([name, deps]) => `[[package]]\nname = "${name}"\nversion = "0.1.0"\n${deps.length ? `dependencies = [\n ${deps.map((d) => `"${d}"`).join(', ')},\n]\n` : ''}`).join('\n');

function workspace() {
  const dir = tempDir('timing-flagged-');
  const put = (p, text) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); };
  put('Cargo.lock', LOCK);
  for (const c of ['base', 'mid', 'lone', 'other']) { put(`crates/${c}/Cargo.toml`, `[package]\nname = "${c}"\n`); put(`crates/${c}/src/lib.rs`, ''); }
  return dir;
}

let logs = 0;
const run = (cmd, exit) => ({ cmd, exit, durationMs: 10 * S, slotWaitMs: 2 * S, log: join(tmpdir(), `timing-flagged-${process.pid}-${logs++}.log`) });
const resultOf = (commands, at = NOW - 60 * S) => ({ id: 'j-a', finishedAt: new Date(at).toISOString(), diffStat: ' crates/base/src/lib.rs | 2 +-', commands });
const flagged = (sample) => Object.fromEntries(sample.entries.filter((e) => e.kind === 'flagged').map((e) => [e.key, e.ms]));

test('a test command for a crate the change does not reach is flagged in the result, and one that reaches it is not', () => {
  const dir = workspace();
  try {
    const result = resultOf([run('cargo t -p mid --lib', 0), run('cargo t -p lone --lib', 0), run('cargo check --workspace', 0)]);
    assert.deepEqual(outsideReachOf(result, [dir]).map((c) => c.cmd), ['cargo t -p lone --lib']);
    const lines = resultSummary(result, { outside: new Set(outsideReachOf(result, [dir])), readLog: () => '' });
    assert.equal(lines.filter((l) => /outside the change's reach/.test(l)).length, 1);
    assert.match(lines[lines.findIndex((l) => /outside the change's reach/.test(l)) - 1], /cargo t -p lone --lib/);
  } finally { cleanup(dir); }
});

test('the profile records whether each flagged command passed or failed, and keeps them out of the ticketed top', () => {
  const dir = workspace();
  try {
    const sample = sampleOf([resultOf([run('cargo t -p lone --lib', 0), run('cargo t -p other --lib', 101)])], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(flagged(sample), { 'lone --lib passed': 12 * S, 'other --lib failed': 12 * S });
    const p = profile([sample], { now: NOW, topN: 5 });
    assert.deepEqual(p.byKind.flagged.map((r) => r.key).sort(), ['lone --lib passed', 'other --lib failed']);
    assert.ok(!p.top.some((r) => r.kind === 'flagged'), 'flagged rows are data, never ticketed');
    assert.ok(p.top.some((r) => r.kind === 'waste' && r.key === 'scope lone --lib'), 'control: the scope waste ranking is unchanged');
  } finally { cleanup(dir); }
});

test('negative control: a command that reaches the change records no flagged entry', () => {
  const dir = workspace();
  try {
    const sample = sampleOf([resultOf([run('cargo t -p mid --lib', 0)])], { project: 'p', lane: 'root', bases: [dir] });
    assert.deepEqual(flagged(sample), {});
    assert.deepEqual(outsideReachOf(resultOf([run('cargo t -p base --lib', 0)]), [dir]), []);
  } finally { cleanup(dir); }
});
