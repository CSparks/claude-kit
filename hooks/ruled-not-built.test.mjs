#!/usr/bin/env node
// ruled-not-built.test.mjs — orient lists decisions a day old or more with neither an implementing ticket nor a
// "no work" note as RULED, NOT BUILT, beside the un-promoted rulings (KIT-T1225).
// Run: node hooks/ruled-not-built.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'kit-ruled-'));
process.env.CLAUDE_KIT_CACHE_DIR = join(tmp, 'cache');
// The harness redirects the registry and the Claude home to temp paths, so orient never reads this machine's state.
const { cleanup, hook } = await import('./test-harness.mjs');
const { RULED_HEADER, ruledNotBuilt, ruledNotBuiltLines } = await import('./lib/orient/ruled-not-built.mjs');
const { reviseDecision } = await import('../scripts/t-revise.mjs');

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

const NOW = Date.parse('2026-11-15T12:00:00Z');
const root = join(tmp, 'p');
const dir = join(root, '.ai', 'decisions');
mkdirSync(dir, { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), 'ids:\n  key: "RN"\n  pad: 3\n');
const decide = (n, { date = '2026-11-13', built = '', noWork = '', extra = '', tracked = true, title = `ruling ${n}` } = {}) => writeFileSync(
  join(dir, `RN-D${String(n).padStart(3, '0')}-ruling.md`),
  `---\nid: RN-D${String(n).padStart(3, '0')}\ntitle: ${title}\ndate: ${date}\n${tracked ? `implemented_by: ${built}\nno_work: ${noWork}\n` : ''}${extra}---\n\n**Decision:** x\n\n**Why:** y\n\n**Maintainer:** "implemented_by: nothing here"\n`,
);

try {
  decide(1, { date: '2026-11-12', title: 'oldest unbuilt ruling' });
  decide(2, { date: '2026-11-14' });
  decide(3, { built: 'RN-T001' });
  decide(4, { noWork: 'a standing rule only' });
  decide(5, { date: '2026-11-15' });
  decide(6, { tracked: false });
  decide(7, { extra: 'promoted: KIT-T900\n' });
  decide(8, { extra: 'status: superseded\n' });

  ok('only a tracked decision a day old or more with neither a ticket nor a no-work note is listed, oldest first', () => {
    assert.deepEqual(ruledNotBuilt(root, NOW).map((m) => [m.id, m.ageDays]), [['RN-D001', 3], ['RN-D002', 1]]);
  });

  ok('controls: built, no-work, today\'s, legacy (no implemented_by line), promoted and superseded decisions are not listed, and the body text is never read as a field', () => {
    const ids = ruledNotBuilt(root, NOW).map((m) => m.id);
    for (const id of ['RN-D003', 'RN-D004', 'RN-D005', 'RN-D006', 'RN-D007', 'RN-D008']) assert.ok(!ids.includes(id), id);
  });

  ok('the block carries the header, id, age and title, and the way to clear each', () => {
    const text = ruledNotBuiltLines(ruledNotBuilt(root, NOW)).join('\n');
    assert.ok(text.startsWith(RULED_HEADER));
    assert.match(text, /RN-D001 \(3d\) oldest unbuilt ruling/);
    assert.match(text, /t revise <id> --ticket <ticket>[\s\S]*--no-work "<why>"/);
  });

  ok('more than eight are cut to a "+N more" tail, and nothing waiting prints nothing', () => {
    const many = Array.from({ length: 11 }, (_, n) => ({ id: `RN-D${n}`, title: 't', ageDays: 2 }));
    assert.match(ruledNotBuiltLines(many).join('\n'), /\+3 more/);
    assert.deepEqual(ruledNotBuiltLines([]), []);
  });

  ok('revising a decision with --ticket or --no-work takes it off the list', () => {
    mkdirSync(join(root, '.ai', 'tickets'), { recursive: true });
    writeFileSync(join(root, '.ai', 'tickets', 'RN-T002-build.md'), '---\nid: RN-T002\ntitle: build\n---\n');
    reviseDecision(root, 'RN-D001', { ticket: 'RN-T002' });
    reviseDecision(root, 'RN-D002', { noWork: 'nothing to build' });
    assert.deepEqual(ruledNotBuilt(root, NOW), []);
    assert.throws(() => reviseDecision(root, 'RN-D001', { ticket: 'RN-T404' }), /not in the store/);
    assert.throws(() => reviseDecision(root, 'RN-D001', { ticket: 'RN-T002', noWork: 'x' }), /exclusive/);
  });

  ok('orient prints the block for an adopted repo', () => {
    const repo = join(tmp, 'repo');
    mkdirSync(join(repo, '.ai', 'decisions'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, '.ai', 'config.yml'), 'ids:\n  key: "OR"\n  pad: 3\n');
    writeFileSync(join(repo, '.ai', 'decisions', 'OR-D001-old.md'), '---\nid: OR-D001\ntitle: an old unbuilt ruling\ndate: 2020-01-01\nimplemented_by: \nno_work: \n---\n\n**Decision:** x\n\n**Why:** y\n');
    const r = hook('orient.mjs', {}, repo, { CLAUDE_KIT_CACHE_DIR: join(tmp, 'cache2'), CLAUDE_KIT_BUG_STORE: join(tmp, 'no-kit-store') });
    assert.match(r.out, /RULED, NOT BUILT[\s\S]*OR-D001 \(\d+d\) an old unbuilt ruling/, r.out.slice(0, 300));
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
  cleanup();
}
console.log(`ruled-not-built: ${passed} passed, 0 failed`);
