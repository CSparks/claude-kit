// Tests for hooks/lib/anchor-guard.mjs (KIT-T1150): the resume-anchor writer follows no link except a
// configured store mount, and writes no backup through a link.
// Run: node scripts/anchor-guard.test.mjs

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSafeAnchor } from '../hooks/lib/anchor-guard.mjs';
import { recordProject } from '../hooks/lib/registry.mjs';
import { setDataRoot, setProject } from './registry-set.mjs';
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

test('a repo whose .ai links into the unbounded store is refused; the unbounded store\'s own root passes', () => {
  const intruder = dir('unbounded-intruder');
  mount(intruder, unboundedAi);
  writeFileSync(registry, JSON.stringify({ dataRoot, unbounded: unboundedAi, projects: { intruder } }));
  assert.throws(() => assertSafeAnchor(intruder), /configured store/);
  assertSafeAnchor(join(unboundedAi, '..'));
});

test('a registered name with ".." or odd characters is refused as a mount', () => {
  for (const name of ['..', 'a..b', 'x y', 'a;b']) {
    const sneaky = dir(`sneaky-${name.length}-${name.charCodeAt(0)}`);
    mount(sneaky, dataRoot);
    writeFileSync(registry, JSON.stringify({ dataRoot, projects: { [name]: sneaky } }));
    assert.throws(() => assertSafeAnchor(sneaky), /configured store/, name);
  }
});

test('a projects folder that is itself a link out of the data repo is refused', () => {
  const outsideData = dir('outside-data');
  const leakRoot = dir('leak-data');
  symlinkSync(outsideData, join(leakRoot, 'projects'), 'junction');
  mkdirSync(join(outsideData, 'p'));
  const leaky = dir('leaky-repo');
  mount(leaky, join(outsideData, 'p'));
  writeFileSync(registry, JSON.stringify({ dataRoot: leakRoot, projects: { p: leaky } }));
  assert.throws(() => assertSafeAnchor(leaky), /configured store/);
});

// --- the registry is not repo-writable (recordProject runs on repo content) ----------------
function recordQuietly(name, repoRoot, dataRoot) {
  const lines = [];
  const write = process.stderr.write;
  process.stderr.write = (s) => { lines.push(String(s)); return true; };
  try { recordProject(name, repoRoot, dataRoot); } finally { process.stderr.write = write; }
  return lines.join('');
}

test('a repo that records a different data root is refused with the command, and the registry is unchanged', () => {
  const registered = dir('reg-a');
  const hostile = dir('hostile-data');
  writeFileSync(registry, JSON.stringify({ dataRoot, projects: {} }));
  const before = readFileSync(registry, 'utf8');
  const said = recordQuietly('reg-a', registered, hostile);
  assert.equal(readFileSync(registry, 'utf8'), before);
  assert.match(said, /registry-set\.mjs" data-root /);
});

test('a repo that records an existing name at a different root is refused with the command, and the registry is unchanged', () => {
  const first = dir('reg-first');
  const second = dir('reg-second');
  writeFileSync(registry, JSON.stringify({ dataRoot, projects: { dup: first } }));
  const before = readFileSync(registry, 'utf8');
  const said = recordQuietly('dup', second, null);
  assert.equal(readFileSync(registry, 'utf8'), before);
  assert.match(said, /registry-set\.mjs" project dup /);
});

test('controls: a new name, the same root restated, a stale path and a first data root are recorded', () => {
  const live = dir('reg-live');
  writeFileSync(registry, JSON.stringify({ projects: { gone: join(base, 'no-such-checkout') } }));
  recordProject('fresh', live, dataRoot);
  recordProject('fresh', live.replace(/\\/g, '/'), dataRoot);
  recordProject('gone', live, null);
  const reg = JSON.parse(readFileSync(registry, 'utf8'));
  assert.equal(reg.dataRoot, dataRoot);
  assert.equal(reg.projects.gone, live);
  assert.ok(reg.projects.fresh);
});

test('registry-set changes a data root and a project on purpose, and rejects a bad project name', () => {
  const target = dir('set-target');
  writeFileSync(registry, JSON.stringify({ dataRoot, projects: { dup: dir('set-old') } }));
  setProject('dup', target);
  setDataRoot(dataRoot);
  assert.equal(JSON.parse(readFileSync(registry, 'utf8')).projects.dup, target);
  assert.throws(() => setProject('a..b', target), /not a project name/);
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
