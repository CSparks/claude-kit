// Working-tree + remote state for a repo, and its shared rendering. git/push-state is
// part of the tracked record: a resume must see what isn't yet committed or pushed,
// anywhere (D-010). Fail-open throughout — an offline or remote-less repo degrades to
// null/empty rather than breaking orientation.

import { execFileSync } from 'node:child_process';
import { git } from './exec.mjs';

// Uncommitted (porcelain) + unpushed (local-only) commits, as raw lists — callers format.
export function wipSummary(repoRoot) {
  const dirty = git(['-C', repoRoot, 'status', '--porcelain']).trim();
  const unpushed = git(['-C', repoRoot, 'log', '--branches', '--not', '--remotes', '--oneline']).trim();
  return {
    clean: !dirty && !unpushed,
    dirty: dirty ? dirty.split('\n') : [],
    unpushed: unpushed ? unpushed.split('\n') : [],
  };
}

// origin's HTTPS web base (no trailing slash), normalizing the common remote forms:
//   git@host:owner/repo.git · ssh://git@host/owner/repo · https://host/owner/repo(.git)
// Returns null when there's no origin / it doesn't parse — the "link" in a landing alert
// (KIT-T021) is then simply omitted, never a guess. Host-agnostic (GitHub/GitLab/Gitea all
// share the /commit/<sha> permalink shape), so no forge is special-cased.
export function remoteWebUrl(root) {
  const raw = git(['-C', root, 'remote', 'get-url', 'origin']).trim();
  if (!raw) return null;
  let m = raw.match(/^git@([^:]+):(.+?)(?:\.git)?$/); // scp-like ssh
  if (m) return `https://${m[1]}/${m[2]}`;
  m = raw.match(/^ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/); // ssh:// url
  if (m) return `https://${m[1]}/${m[2]}`;
  m = raw.match(/^https?:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/); // http(s) url
  if (m) return `https://${m[1]}/${m[2]}`;
  return null;
}

// A web permalink to one commit on origin, or null when there's no usable remote/sha. The
// /commit/<sha> path is the shared convention across the major forges.
export function remoteCommitUrl(root, sha) {
  const base = remoteWebUrl(root);
  return base && sha ? `${base}/commit/${sha}` : null;
}

// Ahead/behind vs upstream for a repo's current branch, with an optional bounded fetch
// so cross-machine divergence is visible at session start (KIT-T054 — wipSummary alone
// is ahead-only, which made a diverged main invisible until `git pull` failed mid-task).
// Fail-open everywhere: offline fetch is swallowed (counts run against last-known remote
// refs), and no-upstream / detached HEAD return null so callers degrade gracefully.
const FETCH_TIMEOUT_MS = 4000;
export function aheadBehind(repoRoot, { fetch = false } = {}) {
  if (fetch) {
    try {
      execFileSync('git', ['-C', repoRoot, 'fetch', '--quiet'], { stdio: 'ignore', timeout: FETCH_TIMEOUT_MS });
    } catch {
      /* offline / slow / no remote — judge against the refs we have */
    }
  }
  const m = git(['-C', repoRoot, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).trim().match(/^(\d+)\s+(\d+)$/);
  if (!m) return null;
  const ahead = Number(m[1]);
  const behind = Number(m[2]);
  return { ahead, behind, diverged: ahead > 0 && behind > 0 };
}

// Multi-line working-tree readout for one repo, shared by orient (single-project resume)
// and survey (cross-project deep view) so the format is defined once.
export const WIP_FILES = 12; // uncommitted files listed before collapsing to "+N more"
export const WIP_COMMITS = 10; // unpushed commits listed
export function formatWip(label, repoRoot, files = WIP_FILES, commits = WIP_COMMITS) {
  const s = wipSummary(repoRoot);
  if (s.clean) return `${label}: clean + pushed`;
  const lines = [`${label}:`];
  if (s.dirty.length) {
    lines.push(`  ${s.dirty.length} uncommitted —`);
    s.dirty.slice(0, files).forEach((l) => lines.push(`    ${l}`));
    if (s.dirty.length > files) lines.push(`    …+${s.dirty.length - files} more`);
  }
  if (s.unpushed.length) {
    lines.push(`  ${s.unpushed.length} unpushed (local-only) commit(s) —`);
    s.unpushed.slice(0, commits).forEach((l) => lines.push(`    ${l}`));
  }
  return lines.join('\n');
}
