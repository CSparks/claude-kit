// git-bash.mjs — finds Git for Windows' bash for `builds --run` (KIT-T1438). A launcher started from the PowerShell tool has
// C:\WINDOWS\system32\bash.exe (WSL) first on PATH: it cannot see D:/ paths or node. The shell is therefore resolved from the
// Git install, never from a bare `bash` on PATH.
//
//   resolveGitBash({ pathEnv, env, exists, platform }) -> absolute path of Git's bash.exe, or null when none is installed
//   GIT_BASH_MISSING                                   -> the refusal text, naming the Bash tool

import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

const BASH_RELATIVE = [['usr', 'bin', 'bash.exe'], ['bin', 'bash.exe']];
const GIT_EXE = ['git.exe', 'git'];
const MAX_LEVELS_ABOVE_GIT_EXE = 3;
const PROGRAM_DIRS = ['ProgramFiles', 'ProgramW6432', 'ProgramFiles(x86)'];

export const GIT_BASH_MISSING = 'builds --run: Git for Windows bash was not found (checked the git on PATH, GIT_INSTALL_ROOT and Program Files), and a bare `bash` on this PATH may be WSL. Launch the call from the Bash tool, whose shell is Git bash.';

const fromRoot = (root, exists) => {
  for (const parts of BASH_RELATIVE) { const candidate = join(root, ...parts); if (exists(candidate)) return candidate; }
  return null;
};

function installRoots(pathEnv, env, exists) {
  const roots = [];
  if (env.GIT_INSTALL_ROOT) roots.push(env.GIT_INSTALL_ROOT);
  for (const dir of pathEnv.split(delimiter).filter(Boolean)) {
    if (!GIT_EXE.some((name) => exists(join(dir, name)))) continue;
    let up = dir;
    for (let level = 0; level <= MAX_LEVELS_ABOVE_GIT_EXE; level += 1) { roots.push(up); up = dirname(up); }
  }
  for (const name of PROGRAM_DIRS) if (env[name]) roots.push(join(env[name], 'Git'));
  if (env.LOCALAPPDATA) roots.push(join(env.LOCALAPPDATA, 'Programs', 'Git'));
  return roots;
}

export function resolveGitBash({ pathEnv = process.env.PATH || process.env.Path || '', env = process.env, exists = existsSync, platform = process.platform } = {}) {
  if (platform !== 'win32') return null;
  for (const root of installRoots(pathEnv, env, exists)) {
    const bash = fromRoot(root, exists);
    if (bash) return bash;
  }
  return null;
}
