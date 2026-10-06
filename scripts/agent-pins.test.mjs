// agent-pins.test.mjs — KIT-D080 (supersedes KIT-T221 / KIT-D061 pins), KIT-T223, KIT-T235.
// Asserts the real repo's agent library (no model line, no model id in agents/commands/skills, full
// manifest registration) and, on temp fixtures, that each check fires on the shape it guards.

import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPins, checkModelIds, checkRegistration, checkInstalledDrift, installedPluginRoot, isDevLinked, readAgents } from './agent-pins.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'agent-pins-'));
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };

const agent = (dir, file, fm) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), `---\n${fm}\n---\n\nbody\n`);
};
const writeAt = (root, rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const fixtureRepo = (name, agentsFm, manifestAgents) => {
  const root = join(tmp, name);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'dispatch:\n  aliases:\n    opus: claude-opus-5-5\nreceipts:\n  on: true\n');
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'x', agents: manifestAgents }));
  for (const [file, fm] of Object.entries(agentsFm)) agent(join(root, 'agents'), file, fm);
  return root;
};

console.log('agent-pins');

// --- the real repo (KIT-D080) ---
ok('no kit agent carries a model line and every one carries an effort', () => {
  assert.deepEqual(checkPins(REPO), []);
  for (const a of readAgents(join(REPO, 'agents'))) assert.equal(a.model, '', `agents/${a.file} has model: ${a.model}`);
});
ok('no model id appears in agents/, commands/ or skills/', () => {
  assert.deepEqual(checkModelIds(REPO), []);
});
ok('the pin-only lane agents are gone', () => {
  for (const lane of ['sonnet55', 'opus55', 'researcher-sonnet55', 'opus48', 'opus5']) {
    assert.ok(!existsSync(join(REPO, 'agents', `${lane}.md`)), `agents/${lane}.md is back`);
  }
});
ok('every kit agent is registered in the plugin manifest', () => {
  assert.deepEqual(checkRegistration(REPO), []);
});

// --- negative controls (each check fires on the shape it guards) ---
ok('a model line in an agent is reported', () => {
  const root = fixtureRepo('pinned', { 'a.md': 'name: a\nmodel: opus\neffort: low' }, ['./agents/a.md']);
  assert.match(checkPins(root)[0], /carry no model/);
});
ok('an agent with no model line and an effort is clean', () => {
  const root = fixtureRepo('clean', { 'a.md': 'name: a\neffort: low' }, ['./agents/a.md']);
  assert.deepEqual(checkPins(root), []);
});
ok('a missing effort is reported', () => {
  const root = fixtureRepo('no-effort', { 'a.md': 'name: a' }, ['./agents/a.md']);
  assert.deepEqual(checkPins(root), ['agents/a.md: no `effort:` pin']);
});
ok('a model id in a command or skill file is reported with its line', () => {
  const root = fixtureRepo('ids', { 'a.md': 'name: a\neffort: low' }, ['./agents/a.md']);
  writeAt(root, 'commands/work.md', 'one\ndispatch on claude-opus-5-5 now\n');
  writeAt(root, 'skills/x/SKILL.md', 'use claude-sonnet-5 here\n');
  const problems = checkModelIds(root);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^commands\/work\.md:2: model id `claude-opus-5-5`/);
  assert.match(problems[1], /^skills\/x\/SKILL\.md:1: model id `claude-sonnet-5`/);
});
ok('a family name and prose are not model ids (negative control)', () => {
  const root = fixtureRepo('families', { 'a.md': 'name: a\neffort: low' }, ['./agents/a.md']);
  writeAt(root, 'commands/work.md', 'dispatch on opus, sonnet or haiku; claude-kit:researcher is an agent\n');
  assert.deepEqual(checkModelIds(root), []);
});
ok('the config aliases block may hold ids (it is outside the scanned dirs)', () => {
  const root = fixtureRepo('config', { 'a.md': 'name: a\neffort: low' }, ['./agents/a.md']);
  assert.deepEqual(checkModelIds(root), []);
});
ok('an unregistered agent file is reported', () => {
  const root = fixtureRepo('unreg', { 'a.md': 'name: a\neffort: low', 'b.md': 'name: b\neffort: medium' }, ['./agents/a.md']);
  assert.deepEqual(checkRegistration(root), ['agents/b.md: not listed in .claude-plugin/plugin.json "agents" — not dispatchable']);
});
ok('a manifest entry with no file is reported', () => {
  const root = fixtureRepo('ghost', { 'a.md': 'name: a\neffort: low' }, ['./agents/a.md', './agents/gone.md']);
  assert.match(checkRegistration(root)[0], /which does not exist/);
});

// --- installed drift (KIT-T235) ---
const src = join(tmp, 'src-agents');
agent(src, 'researcher.md', 'name: researcher\neffort: low');
agent(src, 'light-and-shadow.md', 'name: light-and-shadow\neffort: medium');

ok('an identical installed copy reports no drift', () => {
  const inst = join(tmp, 'inst-clean');
  agent(inst, 'researcher.md', 'name: researcher\neffort: low');
  agent(inst, 'light-and-shadow.md', 'name: light-and-shadow\neffort: medium');
  assert.deepEqual(checkInstalledDrift(src, inst), []);
});
ok('an installed copy still carrying a model line is reported as drift', () => {
  const inst = join(tmp, 'inst-pinned');
  agent(inst, 'researcher.md', 'name: researcher\nmodel: claude-opus-5-5\neffort: low');
  agent(inst, 'light-and-shadow.md', 'name: light-and-shadow\neffort: medium');
  assert.deepEqual(checkInstalledDrift(src, inst), ['researcher.md: installed model `claude-opus-5-5` != source `none`']);
});
ok('an installed copy missing its effort is reported as drift', () => {
  const inst = join(tmp, 'inst-no-effort');
  agent(inst, 'researcher.md', 'name: researcher');
  agent(inst, 'light-and-shadow.md', 'name: light-and-shadow\neffort: medium');
  assert.deepEqual(checkInstalledDrift(src, inst), ['researcher.md: installed effort `none` != source `low`']);
});
ok('a missing installed agent is reported as drift', () => {
  const inst = join(tmp, 'inst-missing');
  agent(inst, 'researcher.md', 'name: researcher\neffort: low');
  assert.deepEqual(checkInstalledDrift(src, inst), ['light-and-shadow.md: missing from the installed copy']);
});
ok('installedPluginRoot falls back to the marketplace copy when installPath has no agents/', () => {
  const plugins = join(tmp, 'plugins');
  mkdirSync(plugins, { recursive: true });
  writeFileSync(join(plugins, 'installed_plugins.json'), JSON.stringify({ plugins: { 'claude-kit@claude-kit': [{ installPath: join(plugins, 'cache', 'nope') }] } }));
  assert.equal(installedPluginRoot(plugins), null);
  mkdirSync(join(plugins, 'cache', 'nope'), { recursive: true }); // present but empty — not the live copy
  assert.equal(installedPluginRoot(plugins), null);
  const market = join(plugins, 'marketplaces', 'claude-kit');
  agent(join(market, 'agents'), 'researcher.md', 'name: researcher\neffort: low');
  assert.equal(installedPluginRoot(plugins), market);
});
ok('a dev-linked install is detected (so drift is skipped)', () => {
  const target = join(tmp, 'link-target');
  mkdirSync(target, { recursive: true });
  const link = join(tmp, 'the-link');
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    console.log('  (symlink unavailable — skipped)');
    return;
  }
  assert.equal(isDevLinked(link), true);
  assert.equal(isDevLinked(target), false);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed`);
