// agent-pins.mjs — integrity of the kit's agent library (KIT-D080): no `agents/*.md` carries a
// `model:` line (the orchestrator picks the family on every dispatch), every agent has an `effort:`,
// is registered in the plugin manifest, and matches the copy installed under ~/.claude/plugins. No
// model id appears in agents/, commands/ or skills/: ids live only in the kit config's aliases block.
//
//   checkPins(repoRoot)             -> string[] problems (a `model:` line, missing effort)
//   checkModelIds(repoRoot)         -> string[] problems (a model id outside the config aliases block)
//   checkRegistration(repoRoot)     -> string[] problems (agent file absent from plugin.json)
//   checkInstalledDrift(src, inst)  -> string[] problems (missing/mismatched installed copy)
//   installedPluginRoot()           -> the installed claude-kit dir, or null

import { readFileSync, readdirSync, existsSync, lstatSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { frontmatterBlock, field } from './frontmatter.mjs';

const INSTALL_KEY = 'claude-kit@claude-kit';

// Every agent definition in `agents/`, with its declared `model:` (empty in the kit) and effort.
export function readAgents(agentsDir) {
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => {
      const fm = frontmatterBlock(readFileSync(join(agentsDir, f), 'utf8'));
      return { file: f, name: field(fm, 'name'), model: field(fm, 'model'), effort: field(fm, 'effort') };
    });
}

export function checkPins(repoRoot) {
  const problems = [];
  for (const a of readAgents(join(repoRoot, 'agents'))) {
    if (a.model) problems.push(`agents/${a.file}: \`model: ${a.model}\` — kit agents carry no model; the orchestrator picks the family per dispatch (KIT-D080)`);
    if (!a.effort) problems.push(`agents/${a.file}: no \`effort:\` pin`);
  }
  return problems;
}

// A model id such as `claude-opus-5-5`: vendor-shaped, family plus version.
const MODEL_ID = /\bclaude-(?:opus|sonnet|haiku|fable)-\d(?:[\w-]|\.\d)*/i;
const ID_SCAN_DIRS = ['agents', 'commands', 'skills'];
const ID_SCAN_EXT = /\.(md|mjs|js|json|ya?ml|txt)$/i;

function* filesUnder(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* filesUnder(full);
    else if (ID_SCAN_EXT.test(name)) yield full;
  }
}

export function checkModelIds(repoRoot) {
  const problems = [];
  for (const dir of ID_SCAN_DIRS) {
    for (const file of filesUnder(join(repoRoot, dir))) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const hit = line.match(MODEL_ID);
        if (!hit) return;
        const rel = relative(repoRoot, file).split(sep).join('/');
        problems.push(`${rel}:${i + 1}: model id \`${hit[0]}\` — ids live only in the kit config dispatch.aliases (KIT-D080); name a family`);
      });
    }
  }
  return problems;
}

export function checkRegistration(repoRoot) {
  const manifest = JSON.parse(readFileSync(join(repoRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  const registered = new Set((manifest.agents || []).map((p) => p.replace(/^\.\/agents\//, '')));
  const problems = [];
  for (const a of readAgents(join(repoRoot, 'agents'))) {
    if (!registered.has(a.file)) problems.push(`agents/${a.file}: not listed in .claude-plugin/plugin.json "agents" — not dispatchable`);
  }
  for (const f of registered) {
    if (!existsSync(join(repoRoot, 'agents', f))) problems.push(`.claude-plugin/plugin.json lists agents/${f}, which does not exist`);
  }
  return problems;
}

// The live installed plugin dir, or null when claude-kit is not installed. The registry's
// `installPath` can name a version-cache dir that is gone or left empty (the marketplace checkout
// is then what the harness loads), so a candidate counts only when it carries an `agents/` dir.
export function installedPluginRoot(pluginsDir = join(homedir(), '.claude', 'plugins')) {
  const candidates = [];
  try {
    const data = JSON.parse(readFileSync(join(pluginsDir, 'installed_plugins.json'), 'utf8'));
    const entry = ((data.plugins && data.plugins[INSTALL_KEY]) || [])[0];
    if (entry && entry.installPath) candidates.push(entry.installPath);
  } catch {
    /* no registry */
  }
  candidates.push(join(pluginsDir, 'marketplaces', 'claude-kit'));
  return candidates.find((p) => existsSync(join(p, 'agents'))) || null;
}

// A dev-linked install IS the source tree — there is nothing to drift.
export function isDevLinked(installRoot) {
  try {
    return lstatSync(installRoot).isSymbolicLink();
  } catch {
    return false;
  }
}

// Compare source `agents/` against the installed copy's. Reports a missing installed file or a
// model/effort mismatch — an installed copy still carrying a pin silently routes the dispatch (KIT-T235).
export function checkInstalledDrift(sourceAgentsDir, installedAgentsDir) {
  const installed = new Map(readAgents(installedAgentsDir).map((a) => [a.file, a]));
  const problems = [];
  for (const a of readAgents(sourceAgentsDir)) {
    const got = installed.get(a.file);
    if (!got) {
      problems.push(`${a.file}: missing from the installed copy`);
      continue;
    }
    if (got.model !== a.model) problems.push(`${a.file}: installed model \`${got.model || 'none'}\` != source \`${a.model || 'none'}\``);
    if (got.effort !== a.effort) problems.push(`${a.file}: installed effort \`${got.effort || 'none'}\` != source \`${a.effort}\``);
  }
  return problems;
}
