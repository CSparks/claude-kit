// agent-pins.mjs — integrity of the kit's agent library: every `agents/*.md` pins a FULL
// model id from the dispatch ladder, is registered in the plugin manifest, and matches the
// copy actually installed under ~/.claude/plugins.
//
// Model aliases (`opus`, `fable`, …) are not pins: `opus` retargeted Opus 4.8 -> Opus 5 with
// no repo change (KIT-D061 rule 1). The checks here are the enforcement surface — consumed by
// scripts/agent-pins.test.mjs (source truth) and hooks/housekeeping.mjs (installed drift).
//
//   checkPins(repoRoot)             -> string[] problems (alias pin, missing effort, off-ladder id)
//   checkRegistration(repoRoot)     -> string[] problems (agent file absent from plugin.json)
//   checkInstalledDrift(src, inst)  -> string[] problems (missing/mismatched installed copy)
//   installedPluginRoot()           -> the installed claude-kit dir, or null

import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { frontmatterBlock, field } from './frontmatter.mjs';

export const MODEL_ALIASES = ['opus', 'sonnet', 'haiku', 'fable'];
const INSTALL_KEY = 'claude-kit@claude-kit';

// Full model ids named by the dispatch ladder (`.ai/config.yml` -> dispatch.tiers), including
// `fallback:` targets. The ladder is the single source of truth for what a legal pin is.
export function ladderModels(repoRoot) {
  const text = readFileSync(join(repoRoot, '.ai', 'config.yml'), 'utf8');
  const block = text.match(/^ {2}tiers:\n([\s\S]*?)(?=\n {2}\w|\n\w)/m);
  const body = block ? block[1] : '';
  return new Set([...body.matchAll(/\b(?:model|fallback):\s*([\w.-]+)/g)].map((m) => m[1]));
}

// Every agent definition in `agents/`, with its declared pin.
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
  const ladder = ladderModels(repoRoot);
  const problems = [];
  for (const a of readAgents(join(repoRoot, 'agents'))) {
    if (!a.model) problems.push(`agents/${a.file}: no \`model:\` pin`);
    else if (MODEL_ALIASES.includes(a.model)) {
      problems.push(`agents/${a.file}: \`model: ${a.model}\` is an ALIAS, not a pin — use a full id (KIT-D061)`);
    } else if (ladder.size && !ladder.has(a.model)) {
      problems.push(`agents/${a.file}: \`model: ${a.model}\` is not on the dispatch ladder`);
    }
    if (!a.effort) problems.push(`agents/${a.file}: no \`effort:\` pin`);
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
// model/effort mismatch — the shape that silently un-pins a dispatch (KIT-T235).
export function checkInstalledDrift(sourceAgentsDir, installedAgentsDir) {
  const installed = new Map(readAgents(installedAgentsDir).map((a) => [a.file, a]));
  const problems = [];
  for (const a of readAgents(sourceAgentsDir)) {
    const got = installed.get(a.file);
    if (!got) {
      problems.push(`${a.file}: missing from the installed copy`);
      continue;
    }
    if (got.model !== a.model) problems.push(`${a.file}: installed model \`${got.model || 'none'}\` != source \`${a.model}\``);
    if (got.effort !== a.effort) problems.push(`${a.file}: installed effort \`${got.effort || 'none'}\` != source \`${a.effort}\``);
  }
  return problems;
}
