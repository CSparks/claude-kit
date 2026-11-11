#!/usr/bin/env node
// plugin-drift.test.mjs — publish refuses while agent/skill/command text the plugin cache will not pick
// up (it refreshes only when plugin.json's version moves) differs under an unchanged version, and while the
// two plugin manifests disagree on the version (KIT-T489, KIT-T1071). Run: node scripts/plugin-drift.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installedPlugin, pluginDrift, publishCheck } from './plugin-drift.mjs';
import { currentRuntime, guardedPublish } from './runtime-publish.mjs';

const repo = mkdtempSync(join(tmpdir(), 'kit-drift-'));
const runtimeRoot = mkdtempSync(join(tmpdir(), 'kit-drift-runtime-'));
const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8' }).trim();
const write = (p, t) => { mkdirSync(join(repo, p, '..'), { recursive: true }); writeFileSync(join(repo, p), t); };
const manifests = (claude, codex) => {
  write('.claude-plugin/plugin.json', JSON.stringify({ name: 'claude-kit', version: claude }));
  write('.codex-plugin/plugin.json', JSON.stringify({ name: 'claude-kit', version: codex }));
};
const publish = (installed) => guardedPublish({ repo, runtimeRoot, installed, graceHours: 0, lines: [] });
const refused = (installed) => assert.throws(() => publish(installed), /refusing to publish/);
let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };

try {
  git('init', '-q');
  manifests('1.0.0', '1.0.0');
  write('agents/worker.md', 'tools: Read\n');
  write('scripts/x.mjs', '1\n');
  git('add', '-A'); git('commit', '-qm', 'cached');
  const installed = { version: '1.0.0', gitCommitSha: git('rev-parse', 'HEAD') };
  const first = git('rev-parse', '--short', 'HEAD');

  ok('a clean tree publishes and moves current', () => {
    publish(installed);
    assert.equal(currentRuntime(runtimeRoot), realpathSync(join(runtimeRoot, first)));
  });

  write('scripts/x.mjs', '2\n');
  git('commit', '-qam', 'script only');
  ok('a script-only change is no drift (scripts load from the runtime copy)', () => assert.deepEqual(pluginDrift({ repo, installed }), []));
  ok('a script-only change still publishes', () => {
    publish(installed);
    assert.equal(currentRuntime(runtimeRoot), realpathSync(join(runtimeRoot, git('rev-parse', '--short', 'HEAD'))));
  });
  const published = currentRuntime(runtimeRoot);

  write('agents/worker.md', 'tools: Read, SendMessage\n');
  git('commit', '-qam', 'agent tools');
  ok('an agent change under the same version is drift, named by path', () => assert.deepEqual(pluginDrift({ repo, installed }), ['agents/worker.md']));
  ok('publishCheck refuses it and names the file and both manifests', () => {
    const { refuse } = publishCheck({ repo, installed });
    assert.equal(refuse.length, 1);
    assert.match(refuse[0], /agents\/worker\.md/);
    assert.match(refuse[0], /\.claude-plugin\/plugin\.json and \.codex-plugin\/plugin\.json/);
  });
  ok('publish throws and current stays where it was', () => {
    refused(installed);
    assert.equal(currentRuntime(runtimeRoot), published);
  });

  write('skills/s/SKILL.md', 'a\n');
  write('commands/work.md', 'b\n');
  write('hooks/hooks.json', '{}\n');
  git('add', '-A'); git('commit', '-qm', 'more plugin text');
  ok('skills, commands and hook wiring count as drift too', () => assert.deepEqual(pluginDrift({ repo, installed }).sort(), ['agents/worker.md', 'commands/work.md', 'hooks/hooks.json', 'skills/s/SKILL.md']));

  manifests('1.0.1', '1.0.0');
  git('commit', '-qam', 'bump claude only');
  ok('a bump of one manifest only is refused as a mismatch, current unmoved', () => {
    assert.deepEqual(pluginDrift({ repo, installed }), []);
    assert.match(publishCheck({ repo, installed }).refuse[0], /1\.0\.1 and \.codex-plugin\/plugin\.json is 1\.0\.0/);
    refused(installed);
    assert.equal(currentRuntime(runtimeRoot), published);
  });

  manifests('1.0.1', '1.0.1');
  git('commit', '-qam', 'bump both');
  ok('negative control: both manifests bumped is no drift and publishes (the cache refreshes at the next session)', () => {
    assert.deepEqual(publishCheck({ repo, installed }), { refuse: [], warn: [] });
    publish(installed);
    assert.equal(currentRuntime(runtimeRoot), realpathSync(join(runtimeRoot, git('rev-parse', '--short', 'HEAD'))));
  });

  ok('negative control: no installed record (plugin not installed here) publishes without warning', () => {
    assert.deepEqual(publishCheck({ repo, installed: null }), { refuse: [], warn: [] });
  });
  ok('an installed commit this repo does not hold cannot be compared: a warning, never a refusal', () => {
    const lost = { version: '1.0.1', gitCommitSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' };
    const { refuse, warn } = publishCheck({ repo, installed: lost });
    assert.deepEqual(refuse, []);
    assert.match(warn[0], /cannot be checked/);
  });
  ok('a repo without a Codex manifest is judged on the Claude manifest alone', () => {
    git('rm', '-rq', '.codex-plugin');
    git('commit', '-qm', 'drop codex manifest');
    assert.deepEqual(publishCheck({ repo, installed }).refuse.length, 0);
  });
  ok('the committed manifest counts, not the working copy: an uncommitted bump does not lift the refusal', () => {
    write('agents/worker.md', 'tools: Read, SendMessage, Bash\n');
    git('commit', '-qam', 'agent change under 1.0.1');
    const cached = { version: '1.0.1', gitCommitSha: git('rev-parse', 'HEAD~1') };
    write('.claude-plugin/plugin.json', JSON.stringify({ name: 'claude-kit', version: '9.9.9' }));
    assert.equal(publishCheck({ repo, installed: cached }).refuse.length, 1);
    git('checkout', '--', '.claude-plugin/plugin.json');
  });

  const file = join(repo, 'installed.json');
  writeFileSync(file, JSON.stringify({ version: 2, plugins: { 'claude-kit@claude-kit': [installed] } }));
  ok('installedPlugin reads the cache record; a missing file is null', () => {
    assert.deepEqual(installedPlugin('claude-kit@claude-kit', file), installed);
    assert.equal(installedPlugin('claude-kit@claude-kit', join(repo, 'none.json')), null);
  });
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(runtimeRoot, { recursive: true, force: true });
}
console.log(`plugin-drift: ${passed} passed, 0 failed`);
