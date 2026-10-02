#!/usr/bin/env node
// Tests for scripts/doc-review.mjs (KIT-T281): one grouped report over the doc-tree lint and the
// structure audit, covering an adopted framework's tree; --done records the review.
// Run: node scripts/doc-review.test.mjs

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { reviewReport } from './doc-review.mjs';
import { docReviewAge } from '../hooks/lib/doc-review.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'doc-review.mjs');
let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmp = mkdtempSync(join(tmpdir(), 'doc-review-'));
const put = (rel, text = '') => { mkdirSync(dirname(join(tmp, rel)), { recursive: true }); writeFileSync(join(tmp, rel), text); };
put('package.json', '{}');
put('README.md', '# Game\n\nThe game.\n');
put('tools/gen.mjs', 'export const g = 1;\n');
put('tools/lone/only.mjs', 'export const o = 1;\n');
put('.gitmodules', '[submodule "rapid-game"]\n\tpath = rapid-game\n');
put('rapid-game/.ai/config.yml', 'ids:\n  key: "RGX"\n');
put('rapid-game/package.json', '{}');
put('rapid-game/lib/x.mjs', 'export const x = 1;\n');

test('report groups doc-tree and structure findings for the project', () => {
  const text = reviewReport(tmp);
  assert.match(text, /== project:/);
  assert.match(text, /-- doc tree \(\d+\)/);
  assert.match(text, /missing-header \(\d+\)/);
  assert.match(text, /-- structure \(\d+\)/);
  assert.match(text, /single-file-folder/);
});

test('report covers the adopted framework tree under its own heading', () => {
  assert.match(reviewReport(tmp), /== framework rapid-game:/);
});

test('--done records the review (age becomes 0 days) in the given HOME', () => {
  const home = mkdtempSync(join(tmpdir(), 'doc-review-home-'));
  const env = { ...process.env, USERPROFILE: home, HOME: home };
  assert.equal(docReviewAge(tmp, home), Infinity);
  const r = spawnSync(process.execPath, [CLI, tmp, '--done'], { encoding: 'utf8', env });
  assert.equal(r.status, 0);
  assert.equal(docReviewAge(tmp, home), 0);
  rmSync(home, { recursive: true, force: true });
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\ndoc-review: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
