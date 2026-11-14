#!/usr/bin/env node
// lessons-digest.test.mjs — the compaction gate digest prints the lesson ids of the repo's framework ledger and the
// model-override tag form (KIT-T1191). Run: node hooks/lessons-digest.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lessonIdRanges, lessonsDigest } from './lib/lessons-digest.mjs';
import { hook, reporter } from './test-harness.mjs';
import { execFileSync } from 'node:child_process';

const { ok, done } = reporter('lessons-digest');
const heading = (id) => `### ${id} A lesson [M+I]\nbody\n`;
const ledger = (ids) => `# Lessons ledger\n\n## 1. Rendering\n\n${ids.map(heading).join('\n')}`;

function game(ids) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-lessons-digest-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  mkdirSync(join(dir, 'rapid-game', 'docs'), { recursive: true });
  if (ids) writeFileSync(join(dir, 'rapid-game', 'docs', 'LESSONS.md'), ledger(ids));
  return dir;
}

const RANGE_IDS = ['L-R01', 'L-R02', 'L-R03', 'L-R04', 'L-A01', 'L-A02', 'L-S01', 'L-S02', 'L-S03', 'L-S05'];
ok('consecutive ids collapse to a range; runs under three stay listed; letters sort', lessonIdRanges(RANGE_IDS).join(' ') === 'L-A01 L-A02 L-R01..04 L-S01..03 L-S05');
ok('a duplicated id counts once', lessonIdRanges(['L-R01', 'L-R01']).join(' ') === 'L-R01');

const withLedger = game(RANGE_IDS);
const line = lessonsDigest(withLedger).join('\n');
ok('a repo with a ledger gets one line naming the id ranges and the tag form', line.includes('L-R01..04') && line.includes('[lessons-checked: L-R01, L-S02]') && !line.includes('\n'));
ok('control: a repo whose framework has no ledger file gets no line', lessonsDigest(game(null)).length === 0);
ok('control: a repo with no framework gets no line', lessonsDigest(mkdtempSync(join(tmpdir(), 'kit-plain-'))).length === 0);

const compact = hook('gate-digest.mjs', { hook_event_name: 'SessionStart', source: 'compact' }, withLedger);
ok('the compact start prints the lessons line after the digest', compact.out.includes('L-R01..04') && compact.out.trim().split('\n')[0].startsWith('GATE DIGEST'));
ok('the compact start prints the model-override tag form beside the job tag', /dispatch-job: \[job: [\w-]+\] or \[model-override: <reason>\]/.test(compact.out));
ok('control: a startup start prints nothing even with a ledger', hook('gate-digest.mjs', { hook_event_name: 'SessionStart', source: 'startup' }, withLedger).out.trim() === '');
done();
