// dispatch-broker.test.mjs — the broker-owned-tree check of dispatch-guard (KIT-T276 L5):
// while a live broker daemon holds a tree's lock, writer-capable dispatches are blocked and
// read-only ones (the patch-worker) pass, including beside a writer already in flight.
// Run: node hooks/dispatch-broker.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixtureKit, isoDaysAgo } from './test-harness.mjs';
const FRESH_KIT = fixtureKit(isoDaysAgo(0));
const HOOK = fileURLToPath(new URL('./dispatch-guard.mjs', import.meta.url));
const DEAD_PID = 2147483646;
let failures = 0;

function repo({ lock }) {
  const dir = mkdtempSync(join(tmpdir(), 'dgb-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = ["game"]\n');
  if (lock) {
    mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
    writeFileSync(join(dir, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: lock === 'live' ? process.pid : DEAD_PID, host: hostname() }));
  }
  return dir;
}

function run(dir, input) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Agent', tool_input: { model: 'opus', ...input, prompt: `${input.prompt || ''} [job: build]` } }),
    env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '', CLAUDE_KIT_LADDER_ROOT: FRESH_KIT },
  });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}

const writer = { subagent_type: 'general-purpose', prompt: 'implement the ticket' };

{
  const live = repo({ lock: 'live' });
  const blocked = run(live, writer);
  expect('a writer-capable dispatch is blocked while the broker lock is live', blocked.code === 2 && /broker-owned-tree|broker daemon owns/.test(blocked.err));
  expect('the block points at patch-worker and names the exclusion id', /patch-worker/.test(blocked.err) && /broker-owned-tree/.test(blocked.err));
  expect('the patch-worker dispatches while the lock is live', run(live, { subagent_type: 'claude-kit:patch-worker', prompt: 'queue the patch' }).code === 0);
  expect('an opus55 writer is blocked while the lock is live', run(live, { subagent_type: 'opus55', prompt: 'implement the ticket' }).code === 2);
  expect('the block message says where a patch worker may write envelopes', /scratchpad or temp dir/.test(blocked.err));
  expect('[read-only: reason] on a writer type passes', run(live, { ...writer, prompt: `${writer.prompt} [read-only: survey only]` }).code === 0);
  expect('the maintainer escape passes', run(live, { ...writer, prompt: `${writer.prompt} [maintainer-asked-parallel: "go ahead"]` }).code === 0);
  expect('an empty escape token does not', run(live, { ...writer, prompt: `${writer.prompt} [maintainer-asked-parallel: ]` }).code === 2);

  writeFileSync(join(live, '.ai', 'agents.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), id: 'agent-w', status: 'in-flight', task: 'edit', scope: 'general-purpose' })}\n`);
  expect('patch-worker still dispatches beside a writer already in flight', run(live, { subagent_type: 'claude-kit:patch-worker', prompt: 'queue the patch' }).code === 0);
}

{
  const ignored = repo({ lock: 'live' });
  writeFileSync(join(ignored, '.claude-kit-ignore.yaml'), 'broker-owned-tree:\n  - "**"\n');
  expect('the ignore file lifts the check', run(ignored, writer).code === 0);
}

expect('a stale lock (dead pid) does not block', run(repo({ lock: 'dead' }), writer).code === 0);
expect('no lock does not block', run(repo({ lock: null }), writer).code === 0);

process.exit(failures ? 1 : 0);
