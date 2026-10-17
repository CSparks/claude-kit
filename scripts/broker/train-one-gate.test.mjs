// train-one-gate.test.mjs — one pre-push gate per PUSH. A train of landing members is one push of
// N commits, so the repo's gate runs once, on the tip commit; no member pays its own gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const FILES = ['a.txt', 'b.txt', 'c.txt'];
const PASS = 'node -e "0"';
const edit = (file, text) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${text}\n>>>>>>> REPLACE\n`;

// A pre-push hook that logs "gate <sha>" for every full run and "fast" when the sha was already stamped green.
function countingGate(s) {
  const dir = tempDir('one-gate-');
  const log = join(dir, 'hook.log').replace(/\\/g, '/');
  const body = [
    'read lref lsha rref rsha',
    'stamp="$(git rev-parse --git-dir)/gate-green"',
    `if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$lsha" ]; then echo "fast" >> "${log}"; exit 0; fi`,
    `echo "gate $lsha" >> "${log}"`,
    'echo "$lsha" > "$stamp"',
  ].join('\n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pre-push'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  g(['config', 'core.hooksPath', dir], s.root);
  return { lines: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim()) : []), done: () => cleanup(dir) };
}

function trainFixture() {
  const s = fixture();
  for (const f of FILES) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', ...FILES], s.root);
  g(['commit', '-m', 'files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }], verify_default: [PASS] });
  return s;
}

function queue(s, file) {
  const { job } = buildPatchJob(s.cfg, { ticket: `T-${file[0]}`, title: `edit ${file}`, land: true }, edit(file, `${file} new`));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  return job;
}

test('a 3-member train runs the pre-push gate exactly once, on the tip commit', () => {
  const s = trainFixture();
  const gate = countingGate(s);
  try {
    const jobs = FILES.map((f) => queue(s, f));
    processOnce(s.cfg);
    assert.deepEqual(jobs.map((j) => readResult(s.cfg, j.id).status), ['landed', 'landed', 'landed']);
    const tip = originSha(s.bare, s.root);
    assert.equal(g(['rev-list', '--count', `${tip}~3..${tip}`], s.root), '3', 'three commits in the one push');
    assert.deepEqual(gate.lines(), [`gate ${tip}`, 'fast'], 'one full gate run on the tip, then the real push takes the stamp');
  } finally { gate.done(); s.done(); }
});

test('control: three single landings each pay a gate (the cost a train removes)', () => {
  const s = trainFixture();
  const gate = countingGate(s);
  try {
    for (const f of FILES) {
      const job = queue(s, f);
      processOnce(s.cfg);
      assert.equal(readResult(s.cfg, job.id).status, 'landed');
    }
    assert.equal(gate.lines().filter((l) => l.startsWith('gate ')).length, 3);
  } finally { gate.done(); s.done(); }
});
