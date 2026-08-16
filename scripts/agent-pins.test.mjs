// agent-pins.test.mjs — KIT-T221 / KIT-T223 / KIT-T235.
// Asserts the real repo's agent library (full-id pins, full manifest registration) and, on temp
// fixtures, that each check actually fires on the shape it exists to catch.

import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPins, checkRegistration, checkInstalledDrift, installedPluginRoot, isDevLinked, readAgents, ladderModels } from './agent-pins.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'agent-pins-'));
let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log(`  ok ${name}`); };

const agent = (dir, file, fm) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), `---\n${fm}\n---\n\nbody\n`);
};
const fixtureRepo = (name, agentsFm, manifestAgents) => {
  const root = join(tmp, name);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'dispatch:\n  tiers:\n    standard: { model: claude-opus-5, effort: low }\n    asset: { model: claude-fable-5, fallback: claude-opus-5, effort: medium }\nreceipts:\n  on: true\n');
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'x', agents: manifestAgents }));
  for (const [file, fm] of Object.entries(agentsFm)) agent(join(root, 'agents'), file, fm);
  return root;
};

console.log('agent-pins');

// --- the real repo (KIT-T221, KIT-T223) ---
ok('every kit agent carries a full-id model pin and an effort', () => {
  assert.deepEqual(checkPins(REPO), []);
});
ok('no kit agent pins a bare alias', () => {
  for (const a of readAgents(join(REPO, 'agents'))) {
    assert.match(a.model, /^claude-/, `agents/${a.file} pins \`${a.model}\``);
  }
});
ok('every kit agent is registered in the plugin manifest', () => {
  assert.deepEqual(checkRegistration(REPO), []);
});
ok('the ladder yields the KIT-D061 model ids', () => {
  const ids = ladderModels(REPO);
  for (const id of ['claude-opus-5', 'claude-opus-4-8', 'claude-fable-5', 'claude-haiku-4-5']) {
    assert.ok(ids.has(id), `ladder missing ${id}`);
  }
  for (const alias of ['opus', 'fable', 'haiku']) assert.ok(!ids.has(alias), `ladder leaked alias ${alias}`);
});

// --- negative controls (each check fires on the shape it guards) ---
ok('an alias pin is reported', () => {
  const root = fixtureRepo('alias', { 'a.md': 'name: a\nmodel: opus\neffort: low' }, ['./agents/a.md']);
  const [p] = checkPins(root);
  assert.match(p, /ALIAS/);
});
ok('a missing effort is reported', () => {
  const root = fixtureRepo('no-effort', { 'a.md': 'name: a\nmodel: claude-opus-5' }, ['./agents/a.md']);
  assert.deepEqual(checkPins(root), ['agents/a.md: no `effort:` pin']);
});
ok('an off-ladder model id is reported', () => {
  const root = fixtureRepo('off-ladder', { 'a.md': 'name: a\nmodel: claude-sonnet-9\neffort: low' }, ['./agents/a.md']);
  assert.match(checkPins(root)[0], /not on the dispatch ladder/);
});
ok('an unregistered agent file is reported', () => {
  const root = fixtureRepo('unreg', { 'a.md': 'name: a\nmodel: claude-opus-5\neffort: low', 'b.md': 'name: b\nmodel: claude-fable-5\neffort: medium' }, ['./agents/a.md']);
  assert.deepEqual(checkRegistration(root), ['agents/b.md: not listed in .claude-plugin/plugin.json "agents" — not dispatchable']);
});
ok('a manifest entry with no file is reported', () => {
  const root = fixtureRepo('ghost', { 'a.md': 'name: a\nmodel: claude-opus-5\neffort: low' }, ['./agents/a.md', './agents/gone.md']);
  assert.match(checkRegistration(root)[0], /which does not exist/);
});

// --- installed drift (KIT-T235) ---
const src = join(tmp, 'src-agents');
agent(src, 'researcher.md', 'name: researcher\nmodel: claude-opus-5\neffort: low');
agent(src, 'light-and-shadow.md', 'name: light-and-shadow\nmodel: claude-fable-5\neffort: medium');

ok('an identical installed copy reports no drift', () => {
  const inst = join(tmp, 'inst-clean');
  agent(inst, 'researcher.md', 'name: researcher\nmodel: claude-opus-5\neffort: low');
  agent(inst, 'light-and-shadow.md', 'name: light-and-shadow\nmodel: claude-fable-5\neffort: medium');
  assert.deepEqual(checkInstalledDrift(src, inst), []);
});
ok('a pinless installed copy is reported as drift', () => {
  const inst = join(tmp, 'inst-pinless');
  agent(inst, 'researcher.md', 'name: researcher');
  agent(inst, 'light-and-shadow.md', 'name: light-and-shadow\nmodel: claude-fable-5\neffort: medium');
  assert.deepEqual(checkInstalledDrift(src, inst), [
    'researcher.md: installed model `none` != source `claude-opus-5`',
    'researcher.md: installed effort `none` != source `low`',
  ]);
});
ok('a missing installed agent is reported as drift', () => {
  const inst = join(tmp, 'inst-missing');
  agent(inst, 'researcher.md', 'name: researcher\nmodel: claude-opus-5\neffort: low');
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
  agent(join(market, 'agents'), 'researcher.md', 'name: researcher\nmodel: claude-opus-5\neffort: low');
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
