// plugin-drift.mjs — sessions load agents, skills, commands and hook wiring from Claude Code's
// plugin cache (~/.claude/plugins/cache/claude-kit/claude-kit/<version>), copied when the plugin
// VERSION changes, never from the repo or the runtime copy (KIT-T489: the patch-worker's
// SendMessage tool never reached a session). publish:runtime runs this and names the files
// that changed since the cached copy while `.claude-plugin/plugin.json` still carries its version.
//
// `pluginDrift({ repo, installed })` → [paths]; `installed` = { version, gitCommitSha }.
// `installedPlugin(name)` → that record from ~/.claude/plugins/installed_plugins.json, or null.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLUGIN_PATHS = ['agents', 'skills', 'commands', 'hooks/hooks.json', '.claude-plugin'];

export function installedPlugin(name = 'claude-kit@claude-kit', file = join(homedir(), '.claude', 'plugins', 'installed_plugins.json')) {
  try {
    const all = JSON.parse(readFileSync(file, 'utf8'));
    const rec = (all.plugins || all)[name];
    return Array.isArray(rec) ? rec[0] : rec || null;
  } catch { return null; }
}

export function pluginDrift({ repo, installed }) {
  if (!installed || !installed.gitCommitSha) return [];
  const version = JSON.parse(readFileSync(join(repo, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  if (version !== installed.version) return [];
  try {
    const out = execFileSync('git', ['-C', repo, 'diff', '--name-only', installed.gitCommitSha, 'HEAD', '--', ...PLUGIN_PATHS], { encoding: 'utf8' });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch { return []; }
}
