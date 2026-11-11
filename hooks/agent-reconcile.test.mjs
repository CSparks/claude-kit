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

// KIT-T1011: a foreground agent's outputFile stays an empty stub; its real transcript is the harness's subagent file.
function subagentFixture({ idleMin, body = ok, stub = true }) {
  const home = mkdtempSync(join(tmpdir(), 'kit-rec-home-'));
  const sub = join(home, 'projects', 'D--dev-proj', 'sess-1', 'subagents');
  mkdirSync(sub, { recursive: true });
  const file = join(sub, 'agent-worker.jsonl');
  writeFileSync(file, body);
  const t = new Date(Date.now() - idleMin * MIN);
  utimesSync(file, t, t);
  const d = mkdtempSync(join(tmpdir(), 'kit-rec-'));
  mkdirSync(join(d, '.ai'));
  const outputFile = join(d, 'worker.output');
  if (stub) { writeFileSync(outputFile, ''); utimesSync(outputFile, new Date(Date.now() - 120 * MIN), new Date(Date.now() - 120 * MIN)); }
  const row = { id: 'worker', status: 'in-flight', task: 't', ts: new Date(Date.now() - 120 * MIN).toISOString(), ...(stub ? { outputFile } : {}) };
  writeFileSync(agentsPath(d), `${JSON.stringify(row)}\n`);
  return { d, home };
}
const statusUnder = ({ d, home }) => {
  process.env.CLAUDE_HOME = home;
  try { return readAgents(d)[0].status; } finally { delete process.env.CLAUDE_HOME; }
};

test('KIT-T1011: a busy worker whose output stub is empty and 2h old is not stale', () => {
  assert.equal(statusUnder(subagentFixture({ idleMin: 1 })), 'in-flight');
});

test('KIT-T1011 control: the same worker with an idle subagent transcript is stale', () => {
  assert.equal(statusUnder(subagentFixture({ idleMin: 90 })), 'stale');
});

test('KIT-T1011 control: an idle subagent transcript ending in a usage limit is killed', () => {
  assert.equal(statusUnder(subagentFixture({ idleMin: 90, body: limit })), 'killed');
});

test('KIT-T1011: an empty output stub and no subagent transcript is no evidence either way', () => {
  const fixture = subagentFixture({ idleMin: 1 });
  assert.equal(statusUnder({ ...fixture, home: mkdtempSync(join(tmpdir(), 'kit-rec-empty-')) }), 'in-flight');
});

test('reconcile:false is a pure read', () => {
  const d = fixture([{ id: 'dead', ageMin: 120, idleMin: 100, transcript: limit }]);
  assert.equal(readAgents(d, 400, { reconcile: false })[0].status, 'in-flight');
});
