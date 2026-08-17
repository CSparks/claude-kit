import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseFramework, usedBy, frameworksFor, frameworkSection } from './frameworks.mjs';

const KIT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const DOC = `---
name: demo-engine
title: demo-engine — the contract
detect:
  submodule: demo-engine
  paths:
    - vendor/demo-engine
    - engine/demo
  cargo: demo-core
---

- A rule that binds every consumer.
`;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'fw-'));
  return dir;
}

function frameworksDir(doc = DOC, name = 'demo-engine.md') {
  const dir = mkdtempSync(join(tmpdir(), 'fwdir-'));
  writeFileSync(join(dir, name), doc);
  return dir;
}

test('a framework doc yields its detect rules and its body', () => {
  const parsed = parseFramework(DOC);
  assert.equal(parsed.name, 'demo-engine');
  assert.equal(parsed.title, 'demo-engine — the contract');
  assert.equal(parsed.submodule, 'demo-engine');
  assert.equal(parsed.cargo, 'demo-core');
  assert.deepEqual(parsed.paths, ['vendor/demo-engine', 'engine/demo']);
  assert.match(parsed.body, /binds every consumer/);
});

test('a doc with no frontmatter is skipped rather than crashing', () => {
  assert.equal(parseFramework('just prose'), null);
});

test('any one signal marks the repo a user — path, submodule or manifest', () => {
  const parsed = parseFramework(DOC);

  const byPath = repo();
  mkdirSync(join(byPath, 'engine', 'demo'), { recursive: true });
  assert.equal(usedBy(byPath, parsed), true);

  const bySubmodule = repo();
  writeFileSync(join(bySubmodule, '.gitmodules'), '[submodule "demo-engine"]\n\tpath = demo-engine\n');
  assert.equal(usedBy(bySubmodule, parsed), true);

  const byCargo = repo();
  writeFileSync(join(byCargo, 'Cargo.toml'), '[dependencies]\ndemo-core = "1"\n');
  assert.equal(usedBy(byCargo, parsed), true);

  for (const dir of [byPath, bySubmodule, byCargo]) rmSync(dir, { recursive: true, force: true });
});

test('a repo that uses nothing gets NO framework section — the whole point', () => {
  const bare = repo();
  const dir = frameworksDir();
  assert.deepEqual(frameworksFor(bare, dir), []);
  rmSync(bare, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('an unrelated dependency does not make the repo a user', () => {
  const web = repo();
  writeFileSync(join(web, 'Cargo.toml'), '[dependencies]\nserde = "1"\n');
  writeFileSync(join(web, '.gitmodules'), '[submodule "styles"]\n\tpath = styles\n');
  const dir = frameworksDir();
  assert.deepEqual(frameworksFor(web, dir), []);
  rmSync(web, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('a detected framework emits a section naming it as binding', () => {
  const game = repo();
  mkdirSync(join(game, 'vendor', 'demo-engine'), { recursive: true });
  const dir = frameworksDir();
  const found = frameworksFor(game, dir);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'demo-engine');
  rmSync(game, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('a malformed doc costs only itself', () => {
  const dir = frameworksDir();
  writeFileSync(join(dir, 'broken.md'), 'no frontmatter here');
  const game = repo();
  mkdirSync(join(game, 'vendor', 'demo-engine'), { recursive: true });
  assert.equal(frameworksFor(game, dir).length, 1);
  rmSync(game, { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
});

test('a missing frameworks tree fails open', () => {
  const game = repo();
  assert.deepEqual(frameworksFor(game, join(game, 'nope')), []);
  assert.equal(frameworkSection(null), '');
  rmSync(game, { recursive: true, force: true });
});

test('the shipped rapid-game contract binds a repo carrying the submodule', () => {
  const game = repo();
  writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  const found = frameworksFor(game, join(KIT, 'frameworks'));
  assert.equal(found.length, 1, 'the rapid-game contract did not bind');
  assert.equal(found[0].name, 'rapid-game');
  assert.match(found[0].body, /EDITOR is the acceptance surface/);
  assert.match(found[0].body, /rg-meshkit/);
  rmSync(game, { recursive: true, force: true });
});

test('the shipped contract stays OUT of a plain web repo', () => {
  const web = repo();
  writeFileSync(join(web, 'package.json'), '{"dependencies":{"react":"18"}}');
  assert.deepEqual(frameworksFor(web, join(KIT, 'frameworks')), []);
  assert.equal(frameworkSection(web), '');
  rmSync(web, { recursive: true, force: true });
});

test('the default frameworks dir resolves to the KIT root, not hooks/', () => {
  const game = repo();
  writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  // No explicit dir: this is the path orientation actually takes.
  assert.match(frameworkSection(game), /FRAMEWORK CONTRACT: rapid-game/);
  rmSync(game, { recursive: true, force: true });
});
