// land-anchor.test.mjs — a broker landing or auto-pin writes its own dated line in `.ai/SESSION.md` through the
// `t session` writer (KIT-T1051), so the resume anchor never trails a landing the daemon made between turns. Controls: a
// failed or unlanded job writes nothing; a second landing appends; the same landing recorded twice writes once; a
// checkout without an `.ai/` store is not given one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, STATUS, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const sessionOf = (s) => join(s.root, '.ai', 'SESSION.md');
const anchor = (s) => (existsSync(sessionOf(s)) ? readFileSync(sessionOf(s), 'utf8') : '');
const lines = (s) => anchor(s).split('\n').filter((l) => l.includes('broker landed'));

function land(s, flags, env) {
  const { job, result, error } = buildPatchJob(s.cfg, flags, env);
  assert.ok(job, JSON.stringify(result || error));
  writeJob(s.cfg, { ...job, commands: [PASS] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}

test('a landing writes one dated line with its sha, ticket and title', () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, '.ai'), { recursive: true });
    const r = land(s, { ticket: 'T-9', title: 'rename beta', land: true }, envelope(['beta', 'BETA']));
    assert.equal(r.status, STATUS.LANDED);
    assert.equal(lines(s).length, 1);
    assert.match(lines(s)[0], new RegExp(`^- \\[\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d\\] broker landed ${r.landed.sha.slice(0, 10)} T-9 rename beta$`));
  } finally { s.done(); }
});

test('a second landing appends a line and keeps the first', () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, '.ai'), { recursive: true });
    writeFileSync(sessionOf(s), '# SESSION\n\n## Current state\n\nhand-written state\n');
    const a = land(s, { ticket: 'T-1', title: 'first', land: true }, envelope(['beta', 'BETA']));
    const b = land(s, { ticket: 'T-2', title: 'second', land: true }, envelope(['BETA', 'GAMMA']));
    assert.equal(lines(s).length, 2);
    assert.ok(anchor(s).includes('hand-written state'), 'the orchestrator\'s own text is kept');
    assert.ok(lines(s)[0].includes(`${b.landed.sha.slice(0, 10)} T-2 second`) && lines(s)[1].includes(`${a.landed.sha.slice(0, 10)} T-1 first`), 'newest first');
  } finally { s.done(); }
});

test('an auto-pin landing writes its line the same way', () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, '.ai'), { recursive: true });
    writeResult(s.cfg, { id: 'j-pin-1', repo: 'app', ticket: 'DE-T9', title: 'pin rapid-game 0123456789', status: STATUS.LANDED, landed: { sha: 'abcdef0123456789abcd' }, commands: [] });
    assert.match(lines(s)[0], /broker landed abcdef0123 DE-T9 pin rapid-game 0123456789$/);
  } finally { s.done(); }
});

test('control: a failed, stale or passed-only job writes nothing', () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, '.ai'), { recursive: true });
    for (const status of [STATUS.FAILED, STATUS.STALE, STATUS.PASSED, STATUS.CONFLICT]) {
      writeResult(s.cfg, { id: `j-${status}`, repo: 'app', ticket: 'T-1', title: 't', status, landed: null, commands: [] });
    }
    assert.equal(existsSync(sessionOf(s)), false);
    const red = land(s, { ticket: 'T-5', title: 'red', land: true }, envelope(['beta', 'BETA']));
    assert.equal(red.status, STATUS.LANDED, 'sanity: a landing still lands');
    writeResult(s.cfg, { id: 'j-failed-after', repo: 'app', ticket: 'T-6', title: 'x', status: STATUS.FAILED, landed: null, commands: [] });
    assert.equal(lines(s).length, 1);
  } finally { s.done(); }
});

test('control: the same landing written twice is one line', () => {
  const s = fixture();
  try {
    mkdirSync(join(s.root, '.ai'), { recursive: true });
    const result = { id: 'j-twice', repo: 'app', ticket: 'T-1', title: 't', status: STATUS.LANDED, landed: { sha: '1234567890abcdef' }, commands: [] };
    writeResult(s.cfg, result);
    writeResult(s.cfg, result);
    assert.equal(lines(s).length, 1);
  } finally { s.done(); }
});

test('control: a checkout with no .ai store is not given one', () => {
  const s = fixture();
  try {
    rmSync(join(s.root, '.ai'), { recursive: true, force: true });
    writeResult(s.cfg, { id: 'j-noai', repo: 'app', ticket: 'T-1', title: 't', status: STATUS.LANDED, landed: { sha: '1234567890abcdef' }, commands: [] });
    assert.equal(existsSync(join(s.root, '.ai')), false);
  } finally { s.done(); }
});
