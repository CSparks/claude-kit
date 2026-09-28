#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — keep every agent on main in the ONE checkout (KIT-D039, KIT-T082).
// exit 2 = block, 0 = allow. No-ops outside adopted repos; fails open on any parse/git error.
//
// BLOCKS:  git switch <non-default> | git switch -c | git checkout -b|-B|--orphan
//          git checkout <non-default branch> | git branch <new> | git branch -m|-c
//          git worktree add | git clone into a project, of a project, or beside a project
//          whose remote it copies
// ALLOWS:  git switch/checkout main|master (the way back) | git checkout [<ref>] -- <file>
//          git branch listing/-d | git worktree list|remove|prune | log/status | non-git commands
// ESCAPE:  only [maintainer-asked-branch: <his words>] in the command.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { payload, git, gitRoot, adopted } from './lib.mjs';
import { classifyGitSegment, tokenize } from './lib/branch-ops.mjs';

const ESCAPE = /\[maintainer-asked-branch:\s*[^\]\s][^\]]*\]/i;
const toPath = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a command runs in: a leading `cd <dir>`, else `git -C <dir>`, else cwd.
function targetDir(cmd) {
  let m = cmd.match(/(?:^|&&|;)\s*cd\s+(\S[^&;|]*)/);
  let path = m ? m[1].trim() : '';
  if (!path) { m = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/); path = m ? m[1].trim() : ''; }
  return path ? toPath(path) : process.cwd();
}

const isUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || (/^[^/\\]+@[^:]+:/.test(s) && !/^[A-Za-z]:[\\/]/.test(s));

// host/owner/repo form, so https, ssh and scp-style spellings of one remote compare equal.
function remoteKey(s) {
  return String(s).trim().toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@/]+@/, '')
    .replace(/^([^/:]+):(?!\d)/, '$1/').replace(/\\/g, '/').replace(/\/+$/, '').replace(/\.git$/, '');
}

function nearestExisting(p) {
  let d = p;
  while (d && !existsSync(d)) { const up = dirname(d); if (up === d) return ''; d = up; }
  return d;
}

const adoptedRootAt = (dir) => { const r = dir ? gitRoot(dir) : ''; return adopted(r) ? r : ''; };

// The adopted sibling repo in `parent` whose remotes include `src`, or ''.
function siblingCopyOf(parent, src) {
  if (!existsSync(parent)) return '';
  const key = remoteKey(src);
  for (const name of readdirSync(parent).slice(0, 500)) {
    const dir = join(parent, name);
    try { if (!statSync(dir).isDirectory() || !existsSync(join(dir, '.git')) || !adopted(dir)) continue; } catch { continue; }
    const urls = git(['-C', dir, 'remote', '-v'], dir).split('\n').map((l) => l.split(/\s+/)[1]).filter(Boolean);
    if (urls.some((u) => remoteKey(u) === key)) return dir;
  }
  return '';
}

// Why a clone makes a second copy of a project, or ''.
function cloneReason({ src, dest }, cwd) {
  const localSrc = isUrl(src) ? '' : resolve(cwd, toPath(src));
  const destAbs = resolve(cwd, toPath(dest || basename(toPath(src)).replace(/\.git$/i, '')));
  const inside = adoptedRootAt(nearestExisting(dirname(destAbs)));
  if (inside) return `clones into project ${inside}`;
  const ofProject = localSrc && existsSync(localSrc) ? adoptedRootAt(localSrc) : '';
  if (ofProject) return `copies project ${ofProject}`;
  const sibling = isUrl(src) || isAbsolute(toPath(src)) ? siblingCopyOf(dirname(destAbs), src) : '';
  return sibling ? `duplicates ${sibling} (same remote) beside it` : '';
}

function blockMessage(op) {
  return [
    '',
    'BLOCKED: a second branch or checkout (KIT-D039, KIT-T082).',
    `  ${op}`,
    '',
    'Every agent works in the ONE checkout, on main, one at a time, keeping it building by',
    'testing each step. No worktrees, clones, feature branches or second work directories:',
    'separate copies duplicate effort and strand work (2026-09-28: half-done work moved into',
    'a second directory, then force-deleted). Commit to main and push instead.',
    '',
    'Only if the maintainer explicitly asked for this, quote him in the command:',
    '  [maintainer-asked-branch: <his words>]',
    '',
  ].join('\n');
}

try {
  const p = await payload();
  const command = (p.tool_input && p.tool_input.command) || '';
  if (!/\bgit\b/.test(command) || !/\b(?:switch|checkout|branch|worktree|clone)\b/.test(command)) process.exit(0);
  if (ESCAPE.test(command)) process.exit(0);

  const cwd = targetDir(command);
  const root = gitRoot(cwd);
  const defaultBranch = root ? git(['-C', root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim().replace(/^origin\//, '') : '';
  const lookups = {
    isBranch: (name) => !!root && git(['-C', root, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).trim() !== '',
    isDefault: (name) => name === 'main' || name === 'master' || (!!defaultBranch && name === defaultBranch),
  };

  for (const seg of command.split(/&&|\|\||[;&|]/).map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git(?:\.exe)?\s+(.+)/s); // a git INVOCATION, not git quoted inside another command
    if (!m) continue;
    const verdict = classifyGitSegment(tokenize(m[1]), lookups);
    let op = '';
    if (verdict.flip && adopted(root)) op = verdict.flip;
    if (verdict.clone) { const why = cloneReason(verdict.clone, cwd); if (why) op = `${seg}   (${why})`; }
    if (op) { process.stderr.write(blockMessage(op)); process.exit(2); }
  }
  process.exit(0);
} catch {
  process.exit(0);
}
