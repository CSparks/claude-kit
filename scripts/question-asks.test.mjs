#!/usr/bin/env node
// Tests for question-asks.mjs — the question lifecycle text (open -> asked -> resolved, KIT-T448)
// and t ask / t resolve through the real CLI. Run: node scripts/question-asks.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  askedEntries, askedLabel, stampAsk, resolutionText, resolveQuestion, questionText, isOpenQuestion,
  questionMatches,
} from './question-asks.mjs';
import { showRows } from './q-show.mjs';
import { query } from './q-lib.mjs';

const T = fileURLToPath(new URL('./t.mjs', import.meta.url));
let pass = 0;
let fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name); } };

const TEMPLATE = `---
id: FQK-Q001
status: open           # open | resolved
answerable_by: pat
created: 2026-10-01
---

**Q:** Should graboids burrow under razed camps before the raid timer ends?

**Resolution:** <answer + date, filled when resolved; set status: resolved>

<!-- one question per file -->
`;

ok('a fresh question is open, unasked, unresolved', isOpenQuestion(TEMPLATE) && !askedEntries(TEMPLATE).length && !resolutionText(TEMPLATE));
ok('a board-status todo question is open too', isOpenQuestion(TEMPLATE.replace('status: open', 'status: todo')));
ok('questionText reads the Q paragraph', questionText(TEMPLATE) === 'Should graboids burrow under razed camps before the raid timer ends?');

const asked = stampAsk(TEMPLATE, 'sess-a', '2026-10-13 09:15');
ok('stampAsk creates History and appends the line', /## History\n- \[2026-10-13 09:15\] \(asked\) sess-a\n$/.test(asked));
ok('askedEntries reads session and date', JSON.stringify(askedEntries(asked)) === JSON.stringify([{ date: '2026-10-13', session: 'sess-a' }]));
ok('askedLabel names session and date', askedLabel(asked) === 'ASKED: sess-a 2026-10-13');
ok('askedLabel is empty for an unasked question', askedLabel(TEMPLATE) === '');
const twice = stampAsk(asked, 'sess-b', '2026-10-14 10:00');
ok('the latest ask wins the label', askedLabel(twice) === 'ASKED: sess-b 2026-10-14' && askedEntries(twice).length === 2);

const done = resolveQuestion(twice, 'pat', 'Yes, burrow.', '2026-10-14 11:00');
ok('resolve writes the Resolution line', resolutionText(done) === '(2026-10-14, pat) Yes, burrow.');
ok('resolve flips status and logs (resolved)', !isOpenQuestion(done) && /status: resolved/.test(done) && /\(resolved\) pat/.test(done));
ok('resolve keeps the asked history', askedEntries(done).length === 2);

ok('questionMatches: shared distinctive words match', questionMatches('Do graboids burrow under razed camps?', TEMPLATE));
ok('questionMatches: unrelated text does not', !questionMatches('Which colour for the stereo mixer faders?', TEMPLATE));
ok('questionMatches: an id citation matches', questionMatches('Decide FQK-Q001 now', TEMPLATE, 'FQK-Q001'));

const dir = mkdtempSync(join(tmpdir(), 'kit-qask-'));
mkdirSync(join(dir, '.ai', 'questions'), { recursive: true });
mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(dir, '.ai', 'config.yml'), 'ids:\n  key: "FQK"\n  pad: 3\n');
const file = join(dir, '.ai', 'questions', 'FQK-Q001-graboids.md');
writeFileSync(file, TEMPLATE.replace('status: open ', 'status: todo '));
const env = { ...process.env, CLAUDE_PLUGIN_ROOT: dir, CLAUDE_KIT_REGISTRY: join(dir, 'reg.json'), KIT_USER: 'pat' };
const t = (args) => spawnSync(process.execPath, [T, '--root', dir, ...args], { encoding: 'utf8', env });
const r1 = t(['ask', 'FQK-Q001', '--session', 'x']);
ok('t ask exits 0 and stamps', r1.status === 0 && askedLabel(readFileSync(file, 'utf8')) === `ASKED: x ${new Date().toISOString().slice(0, 10)}`);
ok('q show prints the ASKED line', showRows('FQK-Q001', dir).some((l) => l.startsWith('ASKED: x ')));
const openRows = (await query('open', [], { root: dir, noDb: true })).rows;
ok('q open appends ASKED to the asked question', openRows.some((r) => r.id === 'FQK-Q001' && r.title.startsWith('ASKED: x ')));
ok('t ask refuses a non-question', t(['ask', 'FQK-T001', '--session', 'x']).status !== 0);
const r2 = t(['resolve', 'FQK-Q001', 'Yes, burrow.']);
ok('t resolve exits 0 and resolves', r2.status === 0 && !isOpenQuestion(readFileSync(file, 'utf8')) && /, pat\) Yes, burrow\./.test(readFileSync(file, 'utf8')));

rmSync(dir, { recursive: true, force: true });
console.log(`\nquestion-asks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
