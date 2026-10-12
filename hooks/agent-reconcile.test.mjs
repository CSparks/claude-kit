// KIT-T428: in-flight rows whose agent died without SubagentStop are reconciled on roster read.
// Run: node --test hooks/agent-reconcile.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAgents, partitionAgents, agentsPath } from './lib.mjs';
import { formatAgentLine } from './lib/agent-format.mjs';

const MIN = 60000;
function fixture(rows, transcripts) {
  const d = mkdtempSync(join(tmpdir(), 'kit-rec-'));
  mkdirSync(join(d, '.ai'));
  const lines = rows.map((r) => {
    const out = r.transcript ? join(d, `${r.id}.jsonl`) : undefined;
    if (r.transcript) {
      writeFileSync(out, r.transcript);
      const t = new Date(Date.now() - r.idleMin * MIN);
      utimesSync(out, t, t);
    }
    return JSON.stringify({ id: r.id, status: 'in-flight', task: 't', ts: new Date(Date.now() - r.ageMin * MIN).toISOString(), ...(out ? { outputFile: out } : {}) });
  });
  writeFileSync(agentsPath(d), lines.join('\n') + '\n');
  return d;
}
const ok = '{"type":"assistant","message":"working"}\n';
const limit = ok + '{"type":"error","error":"429 usage limit reached, resets at 9pm"}\n';

test('429 tail is marked killed: usage-limit and never deleted', () => {
  const d = fixture([{ id: 'dead', ageMin: 120, idleMin: 100, transcript: limit }]);
  const row = readAgents(d)[0];
  assert.equal(row.status, 'killed');
  assert.equal(row.reason, 'usage-limit');
  assert.match(formatAgentLine(row), /killed: usage-limit/);
  assert.equal(partitionAgents(readAgents(d)).inFlight.length, 0);
  assert.equal(readFileSync(agentsPath(d), 'utf8').trim().split('\n').length, 2);
});

test('idle transcript with no completion is stale', () => {
  const d = fixture([{ id: 'idle', ageMin: 120, idleMin: 90, transcript: ok }]);
  assert.equal(readAgents(d)[0].status, 'stale');
});

test('live recent row is untouched (negative control)', () => {
  const d = fixture([
    { id: 'fresh', ageMin: 5, idleMin: 1, transcript: limit },
    { id: 'busy', ageMin: 120, idleMin: 2, transcript: ok },
    { id: 'notrans', ageMin: 120 },
  ]);
  const rows = readAgents(d);
  assert.deepEqual(rows.map((r) => r.status), ['in-flight', 'in-flight', 'in-flight']);
  assert.equal(readFileSync(agentsPath(d), 'utf8').trim().split('\n').length, 3);
});

test('reconcile:false is a pure read', () => {
  const d = fixture([{ id: 'dead', ageMin: 120, idleMin: 100, transcript: limit }]);
  assert.equal(readAgents(d, 400, { reconcile: false })[0].status, 'in-flight');
});
