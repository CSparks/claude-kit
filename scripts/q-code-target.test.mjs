#!/usr/bin/env node
// KIT-T852 / KIT-T850 / KIT-T848: `q code --test|--not-test`, `--repo`, and `--dir` on another git
// checkout (answered from its index, paths absolute) versus a gitignored or plain directory
// (scanned on demand, bounded). Run: node scripts/q-code-target.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { answersElsewhere, codeVerbRows } from './code-index-query.mjs';
import { isTestPath } from './q-test-path.mjs';
import { dirIndex, scanSummary } from './q-scan-dir.mjs';

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const cache = mkdtempSync(join(tmpdir(), 'qct-cache-'));
process.env.CLAUDE_KIT_CODE_INDEX_DIR = cache;
const posix = (p) => p.replace(/\\/g, '/');
const fixture = (prefix, files) => {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
  for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  return dir;
};
const locs = (rows) => rows.map((r) => r.loc).filter(Boolean);

const home = fixture('qct-home-', {
  '.ai/config.yml': 'ids:\n  key: "QCT"\n',
  'src/race.rs': 'fn race_marker() {}\n',
  'tests/race_case.rs': 'fn race_marker_case() {}\n',
  'src/race_test.rs': 'fn race_marker_unit() {}\n',
});

await test('isTestPath: test dirs and test file names, not look-alikes', () => {
  for (const p of ['tests/a.rs', 'a/test/b.py', 'a/__tests__/b.js', 'a/test_b.py', 'a/b_test.rs', 'a/b.test.mjs', 'a/b.nodetest.mjs', 'a/b.spec.ts']) assert.ok(isTestPath(p), p);
  for (const p of ['src/latest.rs', 'src/contest.js', 'src/testing_util.rs', 'docs/attest.md']) assert.ok(!isTestPath(p), p);
});

await test('--test keeps only test files; --not-test drops them (KIT-T852)', async () => {
  assert.deepEqual(locs(await codeVerbRows('code', ['race_marker', '--test', '-l'], home)).sort(), ['src/race_test.rs', 'tests/race_case.rs']);
  assert.deepEqual(locs(await codeVerbRows('code', ['race_marker', '--not-test', '-l'], home)), ['src/race.rs']);
  assert.deepEqual(locs(await codeVerbRows('sym', ['race_marker', '--test', '--fuzzy'], home)).map((l) => l.split(':')[0]).sort(), ['src/race_test.rs', 'tests/race_case.rs']);
});

await test('a bare --repo is the cwd repo; --repo with an unknown name says so (KIT-T850)', async () => {
  assert.deepEqual(locs(await codeVerbRows('code', ['race_marker', '--repo', '--path', 'src/race.rs', '-l'], home)), ['src/race.rs']);
  const rows = await codeVerbRows('code', ['race_marker', '--repo', 'no-such-project-or-dir'], home);
  assert.match(rows[0].text, /neither a registered project nor an existing directory/);
});

const sibling = fixture('qct-sibling-', { 'src/sib.rs': 'fn sibling_marker() {}\n', 'logs/run.log': 'sibling_marker in a log\n', '.gitignore': 'logs/\n' });
const sh = (...a) => execFileSync('git', ['-C', sibling, '-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { stdio: 'ignore' });
sh('init', '-q'); sh('add', '-A'); sh('commit', '-q', '-m', 'base');

await test('--dir / --repo on another git checkout answers from its index with absolute paths (KIT-T848, KIT-T850)', async () => {
  const want = [`${posix(sibling)}/src/sib.rs:1`];
  assert.deepEqual(locs(await codeVerbRows('code', ['sibling_marker', '--dir', sibling], home)), want);
  assert.deepEqual(locs(await codeVerbRows('code', ['sibling_marker', '--repo', sibling], home)), want);
  assert.deepEqual(locs(await codeVerbRows('code', ['sibling_marker', '--dir', join(sibling, 'src')], home)), want);
  assert.deepEqual(locs(await codeVerbRows('code', ['sibling_marker', '--path', join(sibling, 'src')], home)), want);
});

await test('--dir on a gitignored directory inside a checkout is scanned on demand', async () => {
  assert.deepEqual(locs(await codeVerbRows('code', ['sibling_marker', '--dir', join(sibling, 'logs')], home)), [`${posix(sibling)}/logs/run.log:1`]);
});

await test('the resident server leaves --dir, --repo and an outside --path to the caller', () => {
  assert.ok(answersElsewhere(['x', '--dir', sibling], home));
  assert.ok(answersElsewhere(['x', '--repo', 'p'], home));
  assert.ok(answersElsewhere(['x', '--path', posix(sibling)], home));
  assert.ok(!answersElsewhere(['x', '--path', 'src', '--test'], home));
});

const big = fixture('qct-big-', { 'a.txt': 'x\n', 'target/b.txt': 'x\n', 'sub/c.txt': 'x\n' });

await test('a scan past its budget stops and says "no results" proves nothing; build dirs below the target are named, not entered', () => {
  const cut = dirIndex(big, -1);
  assert.ok(cut.truncated);
  assert.match(scanSummary(big, cut), /STOPPED at .* too big to read whole/);
  const whole = dirIndex(big);
  assert.deepEqual(whole.files.map((f) => f.rel.slice(posix(big).length + 1)).sort(), ['a.txt', 'sub/c.txt']);
  assert.deepEqual(whole.buildDirs, ['target']);
  assert.match(scanSummary(big, whole), /not entered: target/);
  assert.equal(dirIndex(join(big, 'target')).scanned, 1, 'naming the build dir scans it');
});

await test('a complete scan with hits carries no stop notice', async () => {
  const rows = await codeVerbRows('code', ['x', '--dir', join(big, 'sub'), '-l'], home);
  assert.deepEqual(locs(rows), [`${posix(join(big, 'sub'))}/c.txt`]);
  assert.ok(!rows.some((r) => /STOPPED/.test(r.text)), 'control: a complete scan has no stop notice');
});

for (const d of [home, sibling, big, cache]) rmSync(d, { recursive: true, force: true });
console.log(`\nq-code-target: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
