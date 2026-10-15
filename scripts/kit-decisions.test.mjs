#!/usr/bin/env node
// Kit decisions replay into other projects' orient (KIT-T507): recent ones show, old ones and the
// kit's own session do not (controls).
// Run: node scripts/kit-decisions.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { recentKitDecisions } from './kit-decisions.mjs';

const kit = mkdtempSync(join(tmpdir(), 'kitdec-'));
const dir = join(kit, '.ai', 'decisions');
mkdirSync(dir, { recursive: true });
const now = Date.parse('2026-10-15T12:00:00Z');
const decision = (name, id, title, date) => writeFileSync(join(dir, name), `---\nid: ${id}\ntitle: ${title}\ndate: ${date}\n---\n\n**Decision:** x\n`);
decision('KIT-D001-old.md', 'KIT-D001', 'An old ruling', '2026-09-01');
decision('KIT-D002-new.md', 'KIT-D002', 'A fresh ruling', '2026-10-14');
writeFileSync(join(dir, 'README.md'), '# decisions\n');

let fail = 0;
const t = (name, fn) => { try { fn(); console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); } };

t('a recent kit decision is replayed to another project; an old one is not', () => {
  const lines = recentKitDecisions('/some/game', { now, kitRoot: kit });
  assert.ok(lines.some((l) => l.includes('KIT-D002 — A fresh ruling')));
  assert.ok(!lines.some((l) => l.includes('KIT-D001')));
});
t('control: the kit session itself gets nothing extra', () => {
  assert.deepEqual(recentKitDecisions(kit, { now, kitRoot: kit }), []);
});
t('control: no kit store registered gives nothing', () => {
  assert.deepEqual(recentKitDecisions('/some/game', { now, kitRoot: null }), []);
});

rmSync(kit, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
