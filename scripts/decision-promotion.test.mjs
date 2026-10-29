// decision-promotion.test.mjs — a project decision about kit or framework concerns is flagged until a KIT/RG
// decision cites it or its frontmatter says `promoted:` (KIT-D111).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promotionLines, unpromoted } from './decision-promotion.mjs';

const decision = (dir, id, title, extra = '') => {
  mkdirSync(join(dir, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(dir, '.ai', 'decisions', `${id}-x.md`), `---\nid: ${id}\ntitle: ${title}\nsummary: \ndate: 2026-10-2${id.length % 10}\n${extra}---\n\nbody\n`);
};

function world() {
  const root = mkdtempSync(join(tmpdir(), 'promo-'));
  const kit = mkdtempSync(join(tmpdir(), 'promo-kit-'));
  mkdirSync(join(kit, '.ai', 'decisions'), { recursive: true });
  decision(root, 'PX-D1', 'The broker runs the full suite nightly, never per landing');
  decision(root, 'PX-D2', 'The garage menu shows a rotating truck');
  decision(root, 'PX-D3', 'Hooks enforce the process', 'promoted: KIT-D5\n');
  decision(root, 'PX-D4', 'Dispatch guard caps the writers');
  decision(root, 'PX-D5', 'Nextest profiles split the GPU tier', 'promoted: none (project-only profile names)\n');
  writeFileSync(join(kit, '.ai', 'decisions', 'KIT-D9-promotes.md'), '---\nid: KIT-D9\n---\nPromotes PX-D4 from the project store.\n');
  return { root, kit, done: () => { rmSync(root, { recursive: true, force: true }); rmSync(kit, { recursive: true, force: true }); } };
}

test('a kit-concern decision with no promotion is flagged; others are not', () => {
  const w = world();
  try {
    assert.deepEqual(unpromoted(w.root, { kitRoot: w.kit }).map((d) => d.id), ['PX-D1']);
  } finally { w.done(); }
});

test('negative controls: a game-only decision, a promoted: line, a "promoted: none" line and a KIT decision citing the id all clear it', () => {
  const w = world();
  try {
    const ids = unpromoted(w.root, { kitRoot: w.kit }).map((d) => d.id);
    for (const id of ['PX-D2', 'PX-D3', 'PX-D4', 'PX-D5']) assert.ok(!ids.includes(id), id);
  } finally { w.done(); }
});

test('orient lines count the store and show the newest few; a clean store and the kit itself print nothing', () => {
  const w = world();
  try {
    const lines = promotionLines(w.root, { kitRoot: w.kit });
    assert.match(lines[0], /UNPROMOTED KIT\/FRAMEWORK DECISIONS \(KIT-D111\): 1 in this store/);
    assert.match(lines[1], /PX-D1/);
    decision(w.root, 'PX-D1', 'The broker runs the full suite nightly, never per landing', 'promoted: KIT-D110\n');
    assert.deepEqual(promotionLines(w.root, { kitRoot: w.kit }), []);
    assert.deepEqual(promotionLines(w.kit, { kitRoot: w.kit }), []);
  } finally { w.done(); }
});
