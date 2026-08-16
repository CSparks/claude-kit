// Shell-free process execution for the hooks. Args always go through as an array,
// so paths with spaces or shell metacharacters cannot be interpreted (no injection
// surface) and there are no OS-shell quoting quirks.
//   git/run   — output only, never throws
//   gitTry/runStatus — output PLUS success/exit code, for callers that must not
//                      mistake failure for empty output

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

export function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// Like git(), but the caller learns whether the command SUCCEEDED and sees stderr.
// For paths that must not mistake failure for empty output (KIT-T053: sync-data's
// push verification — git() swallowing a rejected push produced false receipts).
export function gitTry(args, cwd) {
  try {
    return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    const err = (e && e.stderr && e.stderr.toString()) || (e && e.message) || 'git failed';
    return { ok: false, out: err };
  }
}

// Is a CLI tool on PATH? Shell-free: Windows has `where.exe`; elsewhere walk PATH.
// (No `sh -c command -v` — that would invoke a shell.)
export function have(tool) {
  if (process.platform === 'win32') {
    try {
      execFileSync('where', [tool], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  return (process.env.PATH || '').split(':').some((d) => d && existsSync(join(d, tool)));
}

// Run a command for {code, out}; never throws (a linter's non-zero exit is data,
// not a crash).
export function runStatus(cmd, args, cwd) {
  try {
    return { code: 0, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// Combined output only, for callers that don't care about the exit code.
export function run(cmd, args, cwd) {
  return runStatus(cmd, args, cwd).out;
}

// A node-ecosystem CLI's bin entry, resolved so it can run as `node <bin.js>` —
// shell-free, so it works for .cmd-shimmed global installs on Windows (which
// execFileSync cannot spawn directly) as well as project-local installs.
function binFromPkgDir(pkgDir, tool) {
  try {
    let bin = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).bin;
    if (bin && typeof bin === 'object') bin = bin[tool] ?? Object.values(bin)[0];
    return typeof bin === 'string' ? join(pkgDir, bin) : null;
  } catch {
    return null;
  }
}

export function nodeCli(tool, cwd) {
  try {
    const pjPath = createRequire(join(cwd, 'package.json')).resolve(`${tool}/package.json`);
    const local = binFromPkgDir(dirname(pjPath), tool);
    if (local) return local;
  } catch {
    /* not installed locally — try a global install below */
  }
  if (process.platform === 'win32') {
    const shim = run('where', [tool], cwd).split(/\r?\n/)[0].trim();
    return shim ? binFromPkgDir(join(dirname(shim), 'node_modules', tool), tool) : null;
  }
  // POSIX: the global bin is an executable JS shim with a node shebang; node
  // strips the shebang of the entry file, so running it via node is uniform.
  const dirs = (process.env.PATH || '').split(':');
  const hit = dirs.find((d) => d && existsSync(join(d, tool)));
  return hit ? join(hit, tool) : null;
}
