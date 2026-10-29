// watch.test.mjs — watch.mjs blocks on the next landing / suite run / any finished job (KIT-T697).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { ensureDirs, writeResult } from './result.mjs';
import { eventsSince, matches } from './watch-events.mjs';
import { fixture } from './patchkit.mjs';

const WATCH = join(import.meta.dirname, 'watch.mjs');
const run = (s, ...args) => spawnSync(process.execPath, [WATCH, '--root', s.root, '--poll', '100', ...args], { encoding: 'utf8' });
const writeSuite = (s, sha, body) => {
  const dir = join(brokerPaths(s.cfg).home, 'suite');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sha}.json`), JSON.stringify(body));
};

test('a landing after the start time ends the watch with exit 0; negative: nothing finished times out with exit 2', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const since = new Date(Date.now() - 1000).toISOString();
    assert.equal(run(s, '--for', 'landing', '--timeout', '1', '--since', since).status, 2);
    writeResult(s.cfg, { id: 'j-1-a', repo: 'app', status: 'landed', landed: { sha: 'abc1234' } });
    const r = run(s, '--for', 'landing', '--timeout', '3', '--since', since);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /j-1-a \[app\] → landed abc1234/);
    assert.match(r.stdout, /watch: next --since /);
  } finally { s.done(); }
});

test('a result older than --since is ignored; negative control: a failed job is an "any" event with exit 1 and never a landing', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeResult(s.cfg, { id: 'j-2-old', repo: 'app', status: 'landed', landed: { sha: 'old' } });
    const since = Date.now() + 200;
    assert.deepEqual(eventsSince(s.cfg, since), []);
    const later = new Date(since + 1).toISOString();
    assert.equal(run(s, '--for', 'any', '--timeout', '1', '--since', later).status, 2);
    const before = Date.now() - 5000;
    writeResult(s.cfg, { id: 'j-3-bad', repo: 'app', status: 'failed' });
    const bad = eventsSince(s.cfg, before).find((e) => e.id === 'j-3-bad');
    assert.equal(bad.ok, false);
    assert.equal(matches(bad, 'landing'), false);
    assert.equal(matches(bad, 'any'), true);
    assert.equal(run(s, '--for', 'any', '--timeout', '3', '--since', new Date(before + 1).toISOString()).status, 1);
  } finally { s.done(); }
});

test('a finished suite run ends --for suite (green 0, red 1); a cancelled run and state.json do not count', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const since = new Date(Date.now() - 500).toISOString();
    writeSuite(s, 'state', { lastRun: 'x' });
    writeSuite(s, 'ccc3333', { status: 'cancelled', cancelled: true });
    assert.equal(run(s, '--for', 'suite', '--timeout', '1', '--since', since).status, 2);
    writeSuite(s, 'aaa1111', { status: 'passed' });
    const green = run(s, '--for', 'suite', '--timeout', '3', '--since', since);
    assert.equal(green.status, 0);
    assert.match(green.stdout, /suite aaa1111 → passed/);
    writeSuite(s, 'bbb2222', { status: 'failed', filed: 'k' });
    assert.equal(run(s, '--for', 'suite', '--timeout', '3', '--since', since).status, 1);
  } finally { s.done(); }
});

test('a bad --for or --since is refused with exit 2', () => {
  const s = fixture();
  try {
    assert.equal(run(s, '--for', 'nope').status, 2);
    assert.equal(run(s, '--since', 'not-a-time').status, 2);
  } finally { s.done(); }
});
