// red-by-design: the named-debt test list (`.ai/red-by-design/`) — the writer's refusals, the name matcher, the stale
// notice in orient and the `t red-by-design` verb. Run: node hooks/red-by-design.test.mjs

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, HOOKS, adopted, cleanup, reporter, script } from './test-harness.mjs';
import { STALE_DAYS, readEntries, removeEntry, writeEntry } from './lib/red-by-design.mjs';
import { namesListedTest } from './lib/red-by-design-match.mjs';
import { fitOrientation } from './lib/orient-budget.mjs';
import { STALE_HEADER, staleEntries, staleLines } from './lib/orient/red-by-design.mjs';

const { ok, done } = reporter('red-by-design');
const MS_PER_DAY = 86_400_000;
const NOW = Date.parse('2026-11-23T12:00:00Z');
const TEST = 'crates/rdg-world/tests/frontage_census.rs';

const root = adopted(false);
mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
writeFileSync(join(root, '.ai', 'decisions', 'TT-D001-ruling.md'), '---\nid: TT-D001\ntitle: ruled red\n---\n');
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "TT"\n  pad: 3\n');
const refused = (entry, pattern) => { try { writeEntry(root, entry, { now: NOW }); return false; } catch (e) { return pattern.test(e.message); } };

try {
  ok('an entry with no id is refused', refused({ test: TEST, reason: 'x' }, /decided-by/));
  ok('an id that is not a decision or ticket id is refused', refused({ test: TEST, decidedBy: ['whatever'], reason: 'x' }, /not a decision or ticket id/));
  ok('an id the store does not hold is refused', refused({ test: TEST, decidedBy: ['TT-D404'], reason: 'x' }, /not in this store/));
  ok('an entry with no reason is refused', refused({ test: TEST, decidedBy: ['TT-D001'], reason: ' ' }, /reason/));
  ok('a refused entry writes nothing', readEntries(root).length === 0);

  const first = writeEntry(root, { test: TEST, decidedBy: ['TT-D001'], reason: 'measures "today" # not a comment', owner: 'TT-T9' }, { now: NOW - 20 * MS_PER_DAY });
  const [entry] = readEntries(root);
  ok('an entry round-trips its test, ids, reason, owner and date', entry.test === TEST && entry.decidedBy[0] === 'TT-D001' && entry.reason.includes('# not a comment') && entry.owner === 'TT-T9' && entry.date === '2026-11-03' && !first.replaced);
  ok('the owner defaults to unsigned', (() => { writeEntry(root, { test: 'lanes_once', decidedBy: ['TT-D001'], reason: 'r' }, { now: NOW }); return readEntries(root).find((e) => e.test === 'lanes_once').owner === 'unsigned'; })());
  ok('adding the same test renews it in place', writeEntry(root, { test: TEST, decidedBy: ['TT-D001'], reason: 'again' }, { now: NOW }).replaced && readEntries(root).length === 2 && readEntries(root).find((e) => e.test === TEST).date === '2026-11-23');
  ok('removing an entry deletes its file and a missing one is refused', (() => {
    const { file } = removeEntry(root, 'lanes_once');
    try { removeEntry(root, 'lanes_once'); return false; } catch { return !existsSync(file) && readEntries(root).length === 1; }
  })());

  const listed = [{ test: TEST }, { test: 'towns_planned_once' }];
  ok('the matcher reads a file stem in words', namesListedTest('The frontage census access-ramp test is red.', listed));
  ok('the matcher reads a snake_case name and a bare test name', namesListedTest('towns_planned_once fails', listed) && namesListedTest('The towns planned once test fails.', listed));
  ok('control: the matcher passes a sentence naming no listed test', !namesListedTest('The lanes tests fail.', listed) && !namesListedTest('The frontage tests fail.', listed));
  ok('control: the matcher does not match inside a longer word', !namesListedTest('The frontage censuses test fails.', listed));
  ok('control: the stem in words with no test noun after it names nothing', !namesListedTest('The junction tests fail on the new frontage census.', listed) && !namesListedTest('Frontage census work is done but the lanes tests fail.', listed));
  ok('the matcher reads a .test.ext file name by its stem', namesListedTest('fence_preview.test.mjs fails.', [{ test: 'hooks/fence_preview.test.mjs' }]) && namesListedTest('The fence preview tests fail.', [{ test: 'hooks/fence_preview.test.mjs' }]));

  const old = { test: 'old_one', decidedBy: ['TT-D001'], owner: 'unsigned', date: '2026-11-01' };
  ok('control: an entry exactly at the limit is not stale, one day past is', (() => {
    writeEntry(root, { test: 'edge_case', decidedBy: ['TT-D001'], reason: 'r' }, { now: NOW - STALE_DAYS * MS_PER_DAY });
    writeEntry(root, { test: 'past_edge', decidedBy: ['TT-D001'], reason: 'r' }, { now: NOW - (STALE_DAYS + 1) * MS_PER_DAY });
    return staleEntries(root, NOW).map((e) => e.test).join() === 'past_edge';
  })());
  const text = staleLines([{ ...old, ageDays: 22 }]).join('\n');
  ok('the stale block names the test, age, id, and both ways out', text.startsWith(STALE_HEADER) && /old_one \(22d\) TT-D001; fix: unsigned/.test(text) && /red-by-design add[\s\S]*red-by-design remove/.test(text));
  ok('nothing stale prints nothing', staleLines([]).length === 0);

  const repoDir = adopted(false);
  mkdirSync(join(repoDir, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(repoDir, '.ai', 'config.yml'), 'ids:\n  key: "OR"\n  pad: 3\n');
  writeFileSync(join(repoDir, '.ai', 'decisions', 'OR-D001-x.md'), '---\nid: OR-D001\ntitle: ruled\n---\n');
  writeEntry(repoDir, { test: 'ancient_test', decidedBy: ['OR-D001'], reason: 'r' }, { now: Date.parse('2026-01-01T00:00:00Z') });
  writeEntry(repoDir, { test: 'fresh_test', decidedBy: ['OR-D001'], reason: 'r' });
  const orient = spawnSync(process.execPath, [join(HOOKS, 'orient.mjs')], { cwd: repoDir, encoding: 'utf8', env: { ...ENV, CLAUDE_KIT_CACHE_DIR: join(repoDir, 'cache') } });
  ok('orient prints the stale block and never a fresh entry', /^--- RED BY DESIGN, OVER 14 DAYS/m.test(orient.stdout) && !orient.stdout.includes('fresh_test'));
  ok('the stale block yields to the orient budget by its own rule, keeping the command that lists it', fitOrientation(`--- Recent commits ---\n  a\n${staleLines([{ ...old, ageDays: 22 }, { ...old, test: 'two', ageDays: 21 }, { ...old, test: 'three', ageDays: 20 }, { ...old, test: 'four', ageDays: 19 }]).join('\n')}\n--- Other ---\n${'x'.repeat(200)}`, { budget: 500 }).text.includes('t red-by-design list'));

  const cli = (...args) => script('t.mjs', ['red-by-design', ...args, '--root', root], root);
  const added = cli('add', 'road_geometry', '--decided-by', 'TT-D001', '--reason', 'measures today');
  ok('t red-by-design add writes the entry', added.code === 0 && added.out.includes('added') && readEntries(root).some((e) => e.test === 'road_geometry'));
  ok('t red-by-design list prints it', cli('list').out.includes('road_geometry (0d) TT-D001'));
  ok('t red-by-design add with no id exits 1 and names the flag', (() => { const r = cli('add', 'x_test', '--reason', 'r'); return r.code === 1 && r.err.includes('decided-by'); })());
  ok('t red-by-design remove deletes it', cli('remove', 'road_geometry').code === 0 && !readEntries(root).some((e) => e.test === 'road_geometry'));
  ok('t red-by-design with no action prints usage and exits 2', cli().code === 2);
} finally {
  cleanup();
}

done();
