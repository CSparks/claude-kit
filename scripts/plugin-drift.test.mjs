#!/usr/bin/env node
// plugin-drift.test.mjs — publish names agent/skill/command changes the plugin cache will not pick
// up until plugin.json's version moves (KIT-T489). Run: node scripts/plugin-drift.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installedPlugin, pluginDrift } from './plugin-drift.mjs';

const repo = mkdtempSync(join(tmpdir(), 'kit-drift-'));
const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8' }).trim();
const write = (p, t) => { mkdirSync(join(repo, p, '..'), { recursive: true }); writeFileSync(join(repo, p), t); };
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

try {
  git('init', '-q');
  write('.claude-plugin/plugin.json', JSON.stringify({ name: 'claude-kit', version: '1.0.0' }));
  write('agents/worker.md', 'tools: Read\n');
  write('scripts/x.mjs', '1\n');
  git('add', '-A'); git('commit', '-qm', 'cached');
  const installed = { version: '1.0.0', gitCommitSha: git('rev-parse', 'HEAD') };

  write('scripts/x.mjs', '2\n');
  git('commit', '-qam', 'script only');
  ok('a script-only change is no drift (scripts load from the runtime copy)', () => assert.deepEqual(pluginDrift({ repo, installed }), []));

  write('agents/worker.md', 'tools: Read, SendMessage\n');
  git('commit', '-qam', 'agent tools');
  ok('an agent change under the same version is drift, named by path', () => assert.deepEqual(pluginDrift({ repo, installed }), ['agents/worker.md']));

  write('.claude-plugin/plugin.json', JSON.stringify({ name: 'claude-kit', version: '1.0.1' }));
  git('commit', '-qam', 'bump');
  ok('negative control: a bumped version is no drift (the cache refreshes at the next session)', () => assert.deepEqual(pluginDrift({ repo, installed }), []));

  const file = join(repo, 'installed.json');
  writeFileSync(file, JSON.stringify({ version: 2, plugins: { 'claude-kit@claude-kit': [installed] } }));
  ok('installedPlugin reads the cache record; a missing file is null', () => {
    assert.deepEqual(installedPlugin('claude-kit@claude-kit', file), installed);
    assert.equal(installedPlugin('claude-kit@claude-kit', join(repo, 'none.json')), null);
  });
} finally {
  rmSync(repo, { recursive: true, force: true });
}
console.log(`plugin-drift: ${passed} passed, 0 failed`);
