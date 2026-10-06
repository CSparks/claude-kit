#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const claude = readJson('.claude-plugin/plugin.json');
const codex = readJson('.codex-plugin/plugin.json');
const marketplace = readJson('.agents/plugins/marketplace.json');
const wiring = readJson('hooks/hooks.json');

let pass = 0;
let fail = 0;

function ok(name, condition) {
  if (condition) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

ok('Claude and Codex manifests share the plugin name', claude.name === codex.name);
ok('Claude and Codex manifests share the release version', claude.version === codex.version);
ok('Codex manifest exposes the root skills directory', codex.skills === './skills/');
ok('Codex default bundled hook path exists', existsSync(join(ROOT, 'hooks', 'hooks.json')));
ok('Codex repo marketplace names the plugin', marketplace.plugins?.[0]?.name === codex.name);
ok('Codex repo marketplace points at this plugin root', marketplace.plugins?.[0]?.source?.path === './');
ok('Codex repo marketplace includes install policy', marketplace.plugins?.[0]?.policy?.installation === 'AVAILABLE');
ok('project template carries a Codex AGENTS contract', existsSync(join(ROOT, 'project-template', 'AGENTS.snippet.md')));

const skillDirs = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
for (const entry of skillDirs) {
  ok(`skill ${entry.name} has SKILL.md`, existsSync(join(ROOT, 'skills', entry.name, 'SKILL.md')));
}

const claudeSkills = Array.isArray(claude.skills) ? claude.skills : [claude.skills];
ok('Claude manifest does not sweep in Codex adapter skills', !claudeSkills.includes('./skills/'));

const commands = [];
for (const groups of Object.values(wiring.hooks || {})) {
  for (const group of groups || []) {
    for (const hook of group.hooks || []) {
      if (hook.type === 'command') commands.push(hook.command);
    }
  }
}
ok(
  'every bundled hook uses the dual-host launcher',
  commands.length > 0 && commands.every((command) => command.includes('/hooks/compat-run.mjs')),
);
for (const command of commands) {
  const script = command.match(/compat-run\.mjs\"?\s+([a-z0-9-]+\.mjs)/)?.[1];
  ok(`hook target ${script || '(unparsed)'} exists`, Boolean(script) && existsSync(join(ROOT, 'hooks', script)));
}

// Every committed agent definition must be registered in the Claude manifest, and every
// registered path must exist: an unlisted agent is never offered to a session.
const tracked = spawnSync('git', ['ls-files', 'agents'], { cwd: ROOT, encoding: 'utf8' }).stdout
  .split('\n').filter((f) => /^agents\/[^/]+\.md$/.test(f) && f !== 'agents/README.md');
const registered = claude.agents || [];
for (const file of tracked) {
  ok(`agent ${file} is registered in the plugin manifest`, registered.includes(`./${file}`));
  const head = (readFileSync(join(ROOT, file), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1];
  const field = (k) => (head.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [, ''])[1].trim();
  const stem = file.slice('agents/'.length, -3);
  ok(`agent ${stem} frontmatter: name matches the file; description, tools and effort present, no model line (KIT-D080)`, field('name') === stem && Boolean(field('description')) && Boolean(field('tools')) && Boolean(field('effort')) && !field('model'));
}
for (const entry of registered) ok(`registered agent ${entry} exists`, existsSync(join(ROOT, entry)));
ok('no agent is registered twice', new Set(registered).size === registered.length);

console.log(`\nplugin-compat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
