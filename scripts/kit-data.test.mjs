// kit-data.test.mjs — the capability table is read from the kit checkout's committed HEAD when the code runs
// from a sealed runtime, so a committed re-date is live at once; an uncommitted edit, a fixture root and a
// checkout run still read their own files.
// Run: node scripts/kit-data.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCommitted } from './kit-data.mjs';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };
const base = mkdtempSync(join(tmpdir(), 'kit-data-'));
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' });
const write = (root, text) => { mkdirSync(join(root, '.ai'), { recursive: true }); writeFileSync(join(root, '.ai', 'config.yml'), text); };

try {
  const runtime = join(base, 'abcdef1');
  const checkout = join(base, 'checkout');
  mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '-q');
  write(runtime, 'evidence: sealed\n');
  write(checkout, 'evidence: committed\n');
  git(checkout, 'add', '.');
  git(checkout, 'commit', '-q', '-m', 'table');
  write(checkout, 'evidence: half-edited\n');
  const rel = ['.ai', 'config.yml'];

  ok('a sealed runtime reads the checkout\'s committed HEAD, not its half-edited file', () => {
    assert.equal(readCommitted(runtime, runtime, rel, checkout), 'evidence: committed\n');
  });
  ok('a later commit is live at once, with the runtime untouched', () => {
    write(checkout, 'evidence: recommitted\n');
    git(checkout, 'commit', '-q', '-am', 're-date');
    assert.equal(readCommitted(runtime, runtime, rel, checkout), 'evidence: recommitted\n');
  });
  ok('negative: no registered checkout falls back to the runtime copy', () => {
    assert.equal(readCommitted(runtime, runtime, rel, null), 'evidence: sealed\n');
    assert.equal(readCommitted(runtime, runtime, rel, join(base, 'nowhere')), 'evidence: sealed\n');
  });
  ok('negative: a code root that is not a sealed runtime reads its own file', () => {
    assert.equal(readCommitted(checkout, checkout, rel, checkout), 'evidence: recommitted\n'.replace('recommitted', 'recommitted'));
  });
  ok('negative: a fixture kit root is read as a file even from a sealed runtime', () => {
    const fixture = join(base, 'fixture');
    write(fixture, 'evidence: fixture\n');
    assert.equal(readCommitted(runtime, fixture, rel, checkout), 'evidence: fixture\n');
  });
  ok('a path absent from HEAD falls back to the runtime file', () => {
    write(runtime, 'evidence: sealed\n');
    mkdirSync(join(runtime, 'research'), { recursive: true });
    writeFileSync(join(runtime, 'research', 'only-sealed.md'), 'sealed only\n');
    assert.equal(readCommitted(runtime, runtime, ['research', 'only-sealed.md'], checkout), 'sealed only\n');
  });
} finally {
  rmSync(base, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
