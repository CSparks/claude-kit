// red-run.test.mjs — after two consecutive red jobs on one ticket a submit is refused until the ticket's Notes
// changed since the last red, or --diagnosed is given; a green run clears the count (KIT-T686).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RED_LIMIT, redRunRefusal, ticketNotes } from './red-run.mjs';
import { writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const TICKET = 'T-9';

function withTicket(s) {
  mkdirSync(join(s.root, '.ai', 'tickets'), { recursive: true });
  const file = join(s.root, '.ai', 'tickets', `${TICKET}-red.md`);
  writeFileSync(file, '---\nid: T-9\n---\n\n## Description\nx\n\n## Notes\nstart\n\n## History\n- created\n');
  return file;
}

const red = (s, id, status = 'failed') => writeResult(s.cfg, { id, repo: 'app', ticket: TICKET, status, commands: [] });
const refusal = (s, diagnosed) => redRunRefusal(s.cfg, TICKET, diagnosed);

test('ticketNotes reads only the Notes section; a missing ticket is null', () => {
  const s = fixture();
  try {
    withTicket(s);
    assert.equal(ticketNotes(s.root, TICKET).trim(), '## Notes\nstart');
    assert.equal(ticketNotes(s.root, 'T-404'), null);
  } finally { s.done(); }
});

test('two consecutive reds refuse the next submit; a note on the ticket lifts it', () => {
  const s = fixture();
  try {
    const file = withTicket(s);
    red(s, 'j-1-a');
    assert.equal(refusal(s), null, 'one red is allowed');
    red(s, 'j-2-a');
    assert.equal(RED_LIMIT, 2);
    assert.match(refusal(s), /2 jobs in a row on T-9 are red/);
    const out = buildPatchJob(s.cfg, { ticket: TICKET }, envelope(['beta', 'BETA']));
    assert.match(out.error, /t notes T-9/, 'the submit itself is refused');
    appendFileSync(file, '\n');
    writeFileSync(file, '---\nid: T-9\n---\n\n## Description\nx\n\n## Notes\nstart\ndiagnosis: the match arm was missing\n\n## History\n- created\n');
    assert.equal(refusal(s), null, 'a diagnosis in the Notes lifts the cap');
    assert.ok(buildPatchJob(s.cfg, { ticket: TICKET }, envelope(['beta', 'BETA'])).job);
  } finally { s.done(); }
});

test('after a diagnosis the next red needs a new one (the count is kept)', () => {
  const s = fixture();
  try {
    const file = withTicket(s);
    red(s, 'j-1-a'); red(s, 'j-2-a');
    writeFileSync(file, '---\nid: T-9\n---\n\n## Notes\nfirst diagnosis\n\n## History\n- c\n');
    red(s, 'j-3-a');
    assert.match(refusal(s), /3 jobs in a row/);
  } finally { s.done(); }
});

test('--diagnosed with a real cause lets one submit through; a short one does not', () => {
  const s = fixture();
  try {
    withTicket(s);
    red(s, 'j-1-a'); red(s, 'j-2-a');
    assert.ok(refusal(s, 'oops'), 'too short');
    assert.equal(refusal(s, 'the FeatureKind match in tests/generated_courses.rs needs the new variants'), null);
  } finally { s.done(); }
});

test('negative controls: a green run clears the count, a stale result is not a red, another ticket and a ticket with no file are untouched', () => {
  const s = fixture();
  try {
    withTicket(s);
    red(s, 'j-1-a'); red(s, 'j-2-a');
    red(s, 'j-3-a', 'passed');
    assert.equal(refusal(s), null, 'a pass clears the reds');
    red(s, 'j-4-a'); red(s, 'j-5-a', 'stale'); red(s, 'j-6-a', 'gate');
    assert.equal(refusal(s), null, 'stale and gate results are not reds');
    assert.equal(redRunRefusal(s.cfg, 'T-other', undefined), null);
    writeResult(s.cfg, { id: 'j-7-a', repo: 'app', ticket: 'T-nofile', status: 'failed', commands: [] });
    writeResult(s.cfg, { id: 'j-8-a', repo: 'app', ticket: 'T-nofile', status: 'failed', commands: [] });
    assert.equal(redRunRefusal(s.cfg, 'T-nofile', undefined), null, 'no ticket file: nothing to hold a diagnosis, never refused');
  } finally { s.done(); }
});
