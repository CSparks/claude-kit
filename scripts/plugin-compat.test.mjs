#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

console.log(`\nplugin-compat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
