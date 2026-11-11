// plugin-drift.mjs — sessions load agents, skills, commands and hook wiring from Claude Code's
// plugin cache (~/.claude/plugins/cache/claude-kit/claude-kit/<version>), copied when the plugin
// VERSION changes, never from the repo or the runtime copy (KIT-T489: the patch-worker's
// SendMessage tool never reached a session). publish:runtime refuses to move `current` while
// agent, skill, command or hook-wiring text changed since the cached copy under an unchanged
// version, or while the two plugin manifests disagree on the version (KIT-T1071).
//
// `pluginDrift({ repo, installed })` → [paths]; `installed` = { version, gitCommitSha }.
// `publishCheck({ repo, installed })` → { refuse: [message], warn: [message] }; refuse is empty when a publish may proceed.
// `installedPlugin(name)` → that record from ~/.claude/plugins/installed_plugins.json, or null.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PLUGIN_PATHS = ['agents', 'skills', 'commands', 'hooks/hooks.json', '.claude-plugin'];
const MANIFESTS = { claude: '.claude-plugin/plugin.json', codex: '.codex-plugin/plugin.json' };
const LISTED_FILES = 8;

export function installedPlugin(name = 'claude-kit@claude-kit', file = join(homedir(), '.claude', 'plugins', 'installed_plugins.json')) {
  try {
    const all = JSON.parse(readFileSync(file, 'utf8'));
    const rec = (all.plugins || all)[name];
    return Array.isArray(rec) ? rec[0] : rec || null;
  } catch { return null; }
}

// The version a manifest carries in the COMMITTED tree (the tree a publish exports), or null when HEAD has no such file.
function manifestVersion(repo, rel) {
  try { return JSON.parse(execFileSync('git', ['-C', repo, 'show', `HEAD:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).version; } catch { return null; }
}
const knownCommit = (repo, sha) => {
  try { execFileSync('git', ['-C', repo, 'cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; }
};

export function pluginDrift({ repo, installed }) {
  if (!installed || !installed.gitCommitSha) return [];
  if (manifestVersion(repo, MANIFESTS.claude) !== installed.version) return [];
  try {
    const out = execFileSync('git', ['-C', repo, 'diff', '--name-only', installed.gitCommitSha, 'HEAD', '--', ...PLUGIN_PATHS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch { return []; }
}

/** What stops a publish (`refuse`) and what only deserves a line (`warn`), judged on the committed tree. */
export function publishCheck({ repo, installed }) {
  const refuse = [];
  const warn = [];
  const claude = manifestVersion(repo, MANIFESTS.claude);
  const codex = manifestVersion(repo, MANIFESTS.codex);
  if (codex !== null && codex !== claude) {
    refuse.push(`.claude-plugin/plugin.json is ${claude} and .codex-plugin/plugin.json is ${codex}: bump both to the same version.`);
  }
  if (installed && installed.gitCommitSha && manifestVersion(repo, MANIFESTS.claude) === installed.version && !knownCommit(repo, installed.gitCommitSha)) {
    warn.push(`the plugin cache was copied at ${installed.gitCommitSha}, a commit this repo does not hold, so agent/skill/command drift cannot be checked.`);
  }
  const drift = pluginDrift({ repo, installed });
  if (drift.length) {
    const listed = drift.slice(0, LISTED_FILES).join(', ') + (drift.length > LISTED_FILES ? ', ...' : '');
    refuse.push(`${drift.length} agent/skill/command/hook file(s) changed since the plugin cache was copied, under plugin version ${installed.version}, so sessions would keep the old text: ${listed}. Bump the version in both .claude-plugin/plugin.json and .codex-plugin/plugin.json, commit, then publish.`);
  }
  return { refuse, warn };
}
