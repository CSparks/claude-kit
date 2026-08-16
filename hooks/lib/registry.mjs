// Machine-local project registry: maps each project name -> its repo path ON THIS MACHINE,
// plus the central data root when one is in use. NOT committed anywhere — repo paths are
// machine-specific (Windows drive letters vs macOS paths) while the .ai data syncs across
// machines, so a path written on one machine would be a lie on the other. Self-healed by
// orient whenever a project is opened (T-001). Best-effort: a read returns an empty registry
// on any error; a write never throws.
// CLAUDE_KIT_REGISTRY overrides the path so the test harness can isolate from the real one.
// Resolved at CALL TIME (not frozen at import) so an in-process test can set the override
// after this module loads — same reason the hooks read stdin per-invocation.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export function registryPath() {
  return process.env.CLAUDE_KIT_REGISTRY || join(homedir(), '.claude', 'claude-kit-projects.json');
}
export const REGISTRY = registryPath();

export function readRegistry() {
  try {
    const r = JSON.parse(readFileSync(registryPath(), 'utf8'));
    return { dataRoot: r.dataRoot || null, user: r.user || null, projects: r.projects || {} };
  } catch {
    return { dataRoot: null, user: null, projects: {} };
  }
}

// Every known project's .ai store directory, across ALL scopes — the cross-project
// enumeration shared by survey (briefing) and the cache hydrator (KIT-T031). A project's
// stores live either in its repo (<repo>/.ai) or in the central data root
// (<dataRoot>/projects/<name>, which IS the .ai dir, not a parent of one); resolve to
// whichever exists, preferring the repo. Returns { name, aiDir } per project with stores.
// Best-effort: any unreadable entry is skipped, never thrown.
export function projectAiDirs() {
  const reg = readRegistry();
  const names = new Set(Object.keys(reg.projects));
  if (reg.dataRoot) {
    try {
      for (const d of readdirSync(join(reg.dataRoot, 'projects'), { withFileTypes: true })) {
        if (d.isDirectory()) names.add(d.name);
      }
    } catch {
      /* no central data dir — registry-only */
    }
  }
  const out = [];
  for (const name of names) {
    const repo = reg.projects[name];
    const repoAi = repo ? join(repo, '.ai') : null;
    const centralAi = reg.dataRoot ? join(reg.dataRoot, 'projects', name) : null;
    let aiDir = null;
    if (repoAi && existsSync(repoAi)) aiDir = repoAi;
    else if (centralAi && existsSync(join(centralAi, 'config.yml'))) aiDir = centralAi;
    if (aiDir) out.push({ name, aiDir });
  }
  return out;
}

export function recordProject(name, repoRoot, dataRoot) {
  if (!name || !repoRoot) return;
  try {
    const reg = readRegistry();
    let changed = false;
    if (reg.projects[name] !== repoRoot) {
      reg.projects[name] = repoRoot;
      changed = true;
    }
    if (dataRoot && reg.dataRoot !== dataRoot) {
      reg.dataRoot = dataRoot;
      changed = true;
    }
    if (!changed) return;
    const p = registryPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(reg, null, 2) + '\n');
  } catch {
    /* registry is best-effort — never break a hook */
  }
}
