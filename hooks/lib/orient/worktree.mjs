// worktree.mjs — commits and working-tree temperature (KIT-T225, KIT-T054, KIT-T134, KIT-T016): recent and fresh
// commits, the not-centralized and memory-split banners, and uncommitted + unpushed work across the project, its data
// repo and any watched repos.
//
//   worktreeSection(ctx) -> { repos, wips, recentCommitLines }

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { aheadBehind, centralDataRoot, fetchRepos, formatWip, git, projectName, readRegistry, recordProject, watchRepos, wipSummary } from '../../lib.mjs';
import { memoryLinkCommand, unifyMemory } from '../../memory-link.mjs';
import { ORIENT_WINDOW_MIN, recentCommits } from '../../live-sessions.mjs';
import { COMMITS, LINE_MAX, WIP_COMMITS_SHOWN, WIP_FILES_SHOWN, clip } from './common.mjs';

const FRESH_SUBJECT_MAX = 80;

const isKitRepo = (r) => {
  try { return JSON.parse(readFileSync(join(r, 'package.json'), 'utf8')).name === 'claude-kit'; } catch { return false; }
};

// An in-repo notebook while a central store IS registered is adopted locally but never centralized (KIT-T134).
function centralBanners(root, dataRoot) {
  try {
    const regDataRoot = readRegistry().dataRoot;
    if (dataRoot === null && regDataRoot && existsSync(join(root, '.ai')) && !isKitRepo(root)) {
      return [`!! NOTEBOOK IN-REPO, NOT CENTRALIZED: a central store is registered (${regDataRoot}) but this project's .ai lives in-repo — invisible on other machines. Centralize it: node <kit>/scripts/reconcile-central.mjs (dry-run) then --execute ${projectName(root)}.`];
    }
  } catch {
    /* tripwire is best-effort — never break orientation */
  }
  return [];
}

// ENFORCE the harness-memory and committed-memory unification (KIT-T016).
function memoryBanners(root) {
  try {
    const mem = unifyMemory(root);
    if (mem.action === 'linked') return [`!! MEMORY LINK HEALED: ${mem.harnessDir} → ${mem.repoDir} (harness memory was machine-local; now writes to the committed, synced copy).`];
    if (mem.action === 'diverged') return [`!! MEMORY SPLIT: the harness wrote local memory at ${mem.harnessDir} that DIFFERS from the committed ${mem.repoDir} — reconcile the two, then link: ${memoryLinkCommand(root)}`];
    if (mem.action === 'failed') return [`!! MEMORY NOT UNIFIED: could not auto-link ${mem.harnessDir} → ${mem.repoDir}; new memory may be machine-local + lost. Link it: ${memoryLinkCommand(root)}`];
  } catch {
    /* unification is best-effort — never break orientation */
  }
  return [];
}

export async function worktreeSection({ out, root }) {
  out.push('--- Recent commits ---');
  const recentCommitLines = git(['-C', root, 'log', '--oneline', `-${COMMITS}`]) || '';
  out.push(recentCommitLines.trim().split('\n').map((l) => clip(l, LINE_MAX)).join('\n'));

  // A commit landed minutes ago, before this session existed, is the signature of another live session (KIT-T225).
  const fresh = recentCommits(root, ORIENT_WINDOW_MIN);
  if (fresh.length) {
    out.push('');
    out.push(`!! FRESH COMMITS (last ${ORIENT_WINDOW_MIN} min) — MAY BE ANOTHER LIVE SESSION in this repo:`);
    for (const c of fresh) out.push(`  ${c.sha} ${c.minutes}m ago (${c.author}) ${clip(c.subject, FRESH_SUBJECT_MAX)}`);
    out.push('  If you did not make these, coordinate before editing shared files (one checkout, on main — KIT-D039).');
  }

  const dataRoot = centralDataRoot(root);
  recordProject(projectName(root), root, dataRoot);
  const banners = centralBanners(root, dataRoot);
  const memBanners = memoryBanners(root);

  const repos = [[root, `project (${basename(root)})`]];
  if (dataRoot) repos.push([dataRoot, 'data repo (.ai)']);
  for (const rel of watchRepos(root)) {
    const abs = resolve(root, rel);
    if (existsSync(abs)) repos.push([abs, `watched: ${basename(abs)}`]);
  }
  out.push('');
  out.push('--- Working tree (uncommitted + unpushed) ---');
  const divergedLabels = [];
  const wips = new Map(repos.map(([r]) => [r, wipSummary(r)]));
  await fetchRepos(repos.map(([r]) => r));
  for (const [r, label] of repos) {
    out.push(formatWip(label, r, WIP_FILES_SHOWN, WIP_COMMITS_SHOWN, wips.get(r)));
    const ab = aheadBehind(r);
    if (ab && (ab.behind || ab.diverged)) {
      out.push(`  vs origin: ahead ${ab.ahead} / behind ${ab.behind}${ab.diverged ? ' — DIVERGED' : ''}`);
      if (ab.diverged) divergedLabels.push(label);
    }
  }
  if (divergedLabels.length) {
    out.splice(1, 0, `!! DIVERGED FROM ORIGIN: ${divergedLabels.join(', ')} — fetch + rebase BEFORE working; two machines hold different history.`);
  }
  if (memBanners.length) out.splice(1, 0, ...memBanners);
  if (banners.length) out.splice(1, 0, ...banners);
  return { repos, wips, recentCommitLines };
}
