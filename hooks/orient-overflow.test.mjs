// orient overflow (KIT-T1463): the start text stays inside 9,500 BYTES with the cost line counted, the rules block and the
// stale warning are never shortened, and the lists of finished runs, built-less rulings and unpromoted decisions shrink to a
// count and one command. Run: node hooks/orient-overflow.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, git, hook, reporter } from './test-harness.mjs';
import { COST_LINE_RESERVE_BYTES, ORIENT_BUDGET_BYTES, fitOrientation } from './lib/orient-budget.mjs';
import { ruleBlockText } from './lib/rule-block.mjs';

const { ok, done } = reporter('orient-overflow');
const ROWS = 70;
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const block = ruleBlockText();

try {
  const unit = (rows, line) => Array.from({ length: rows }, (_, i) => line(i));
  const synthetic = [
    block, '=== PROJECT ORIENTATION ===',
    '--- OPEN, awaiting a bill of work: ended workers left work open ---', ...unit(ROWS, (i) => `  KIT-T${i}: RETIRED WITH HANDOFF — a long line about what the worker left open, with an em dash —`),
    '--- RULED, NOT BUILT (decisions) ---', ...unit(ROWS, (i) => `  KIT-D${i} (3d) a ruling that nothing builds yet — ${'words '.repeat(6)}`),
    '--- UNPROMOTED KIT/FRAMEWORK DECISIONS ---', ...unit(ROWS, (i) => `  RG-D${i} a framework decision awaiting promotion — ${'words '.repeat(6)}`),
  ].join('\n');
  const fit = fitOrientation(synthetic, { pointer: ' — full: /tmp/orient.txt' });
  ok(`70-row lists fit ${ORIENT_BUDGET_BYTES - COST_LINE_RESERVE_BYTES} bytes with the cost line reserved (${bytes(fit.text)} bytes)`, bytes(fit.text) <= ORIENT_BUDGET_BYTES - COST_LINE_RESERVE_BYTES);
  ok('the rules block survives whole and first', fit.text.startsWith(`${block}\n`));
  ok('the finished-runs list becomes a count and one command', /--- OPEN, awaiting a bill of work[^\n]*\n(?:  [^\n]*\n){0,2}  … \(\+\d+ lines\) — `q open`/.test(fit.text));
  ok('the rulings list becomes a count and one command', /--- RULED, NOT BUILT[^\n]*\n(?:  [^\n]*\n){0,2}  … \(\+\d+ lines\) — `t revise <id> --ticket <ticket>`/.test(fit.text));
  ok('the unpromoted decisions list becomes a count and one command', /--- UNPROMOTED KIT\/FRAMEWORK DECISIONS[^\n]*\n(?:  [^\n]*\n){0,2}  … \(\+\d+ lines\) — `q recent 30d`/.test(fit.text));
  const multibyte = ['--- Open work ---', ...unit(160, () => `  ${'—'.repeat(40)}`)].join('\n');
  ok('size counts bytes, not characters', multibyte.length < ORIENT_BUDGET_BYTES && bytes(multibyte) > ORIENT_BUDGET_BYTES && bytes(fitOrientation(multibyte, { budget: ORIENT_BUDGET_BYTES }).text) <= ORIENT_BUDGET_BYTES);

  const repo = adopted(false);
  mkdirSync(join(repo, '.ai', 'tickets'), { recursive: true });
  const rows = [];
  for (let i = 1; i <= ROWS; i += 1) {
    const id = `T-${String(i).padStart(3, '0')}`;
    writeFileSync(join(repo, '.ai', 'tickets', `${id}-work.md`), `---\nid: ${id}\ntitle: open work number ${i} with a title that runs on for a while\nstatus: doing\n---\n\n## Notes\n\n### Handoff agent-${i}\n- Jobs: j-${i} (landed)\n- State: the worker stopped after step ${i} with the lane host half wired\n- Next: finish step ${i + 1} and re-check the lane host output against the baseline\n- Files: crates/lanes/src/host_${i}.rs\n\n## History\n`);
    rows.push({ ts: new Date().toISOString(), id: `agent-${i}`, status: 'done', scope: 'p:implementer', tickets: [id] });
  }
  writeFileSync(join(repo, '.ai', 'agents.jsonl'), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
  git(['add', '-A'], repo);
  const r = hook('orient.mjs', {}, repo);
  ok(`real orient with ${ROWS} finished runs prints at most ${ORIENT_BUDGET_BYTES} bytes (${bytes(r.out)} bytes)`, bytes(r.out) <= ORIENT_BUDGET_BYTES);
  ok('real orient starts with the rules block', r.out.startsWith(`${block}\n`));
  ok('real orient names the finished-runs list as a count and `q open`', /OPEN, awaiting a bill of work[^\n]*\n(?:[^\n]*\n)*?\s+… \(\+\d+ lines\) — `q open`/.test(r.out));
  ok('real orient still carries the cost line last', /context: orient \d+/.test(r.out.trim().split('\n').pop()));
} finally {
  cleanup();
}
done();
