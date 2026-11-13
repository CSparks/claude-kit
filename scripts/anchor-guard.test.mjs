// Tests for hooks/lib/anchor-guard.mjs (KIT-T1150): the resume-anchor writer follows no link except a
// configured store mount, and writes no backup through a link.
// Run: node scripts/anchor-guard.test.mjs

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSafeAnchor } from '../hooks/lib/anchor-guard.mjs';
import { writeSession } from './t-session.mjs';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const base = mkdtempSync(join(tmpdir(), 'anchor-guard-'));
const dir = (...parts) => { const p = join(base, ...parts); mkdirSync(p, { recursive: true }); return p; };
const mount = (repo, target) => symlinkSync(target, join(repo, '.ai'), 'junction');

const dataRoot = dir('claude-kit-data');
const proj = dir('claude-kit-data', 'projects', 'proj');
const other = dir('claude-kit-data', 'projects', 'other');
const repo = dir('repo');
const otherRepo = dir('other-repo');
const unboundedAi = dir('claude-kit-data', 'unbounded', '.ai');
const registry = join(base, 'registry.json');
writeFileSync(registry, JSON.stringify({ dataRoot, unbounded: unboundedAi, projects: { proj: repo, other: otherRepo } }));
process.env.CLAUDE_KIT_REGISTRY = registry;
delete process.env.CLAUDE_KIT_UNBOUNDED_AI;

test('a .ai linked to <dataRoot>/projects/<this project> is allowed', () => {
  mount(repo, proj);
  assertSafeAnchor(repo);
});

test('a .ai linked to another registered project\'s store is refused', () => {
  const stray = dir('stray-repo');
  mount(stray, other);
  writeFileSync(registry, JSON.stringify({ dataRoot, unbounded: unboundedAi, projects: { proj: repo, other: otherRepo, stray } }));
  assert.throws(() => assertSafeAnchor(stray), /does not lead to this project's configured store/);
});

test('a look-alike projects layout outside the configured data repo is refused', () => {
  const fake = dir('elsewhere', 'claude-kit-data', 'projects', 'proj');
  const victim = dir('victim-repo');
  mount(victim, fake);
  writeFileSync(registry, JSON.stringify({ dataRoot, unbounded: unboundedAi, projects: { proj: victim } }));
  assert.throws(() => assertSafeAnchor(victim), /configured store/);
  writeFileSync(join(fake, 'SESSION.md'), '# FAKE\n');
  assert.throws(() => writeSession(victim, 'note'), /configured store/);
  assert.equal(readFileSync(join(fake, 'SESSION.md'), 'utf8'), '# FAKE\n');
});

test('an unregistered repo with a linked .ai is refused even when it points into the data repo', () => {
  const unlisted = dir('unlisted-repo');
  mount(unlisted, proj);
  writeFileSync(registry, JSON.stringify({ dataRoot, projects: {} }));
  assert.throws(() => assertSafeAnchor(unlisted), /configured store/);
});

test('control: a plain .ai is written and its previous file is backed up', () => {
  const plain = dir('plain-repo');
  mkdirSync(join(plain, '.ai'));
  writeFileSync(join(plain, '.ai', 'SESSION.md'), '# S\n');
  writeSession(plain, 'one');
  assert.match(readFileSync(join(plain, '.ai', 'SESSION.md'), 'utf8'), /one/);
  assert.equal(readdirSync(join(plain, '.ai', '.session-backups')).filter((f) => f.endsWith('.md')).length, 1);
});

test('a linked .session-backups is refused: the anchor is untouched and nothing lands behind the link', () => {
  const linked = dir('backup-link-repo');
  mkdirSync(join(linked, '.ai'));
  writeFileSync(join(linked, '.ai', 'SESSION.md'), '# S\n');
  const behind = dir('behind-the-link');
  symlinkSync(behind, join(linked, '.ai', '.session-backups'), 'junction');
  assert.throws(() => writeSession(linked, 'note'), /is a link; backups are not written through it/);
  assert.equal(readFileSync(join(linked, '.ai', 'SESSION.md'), 'utf8'), '# S\n');
  assert.deepEqual(readdirSync(behind), []);
});

test('a note that takes no backup writes without touching the backup folder', () => {
  const quiet = dir('quiet-repo');
  mkdirSync(join(quiet, '.ai'));
  writeFileSync(join(quiet, '.ai', 'SESSION.md'), '# S\n');
  writeSession(quiet, 'auto', { backup: false });
  assert.equal(existsSync(join(quiet, '.ai', '.session-backups')), false);
});

rmSync(base, { recursive: true, force: true });
console.log(`\nanchor-guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
