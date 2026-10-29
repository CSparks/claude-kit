// check-tree.mjs — the broker's own tree for check runs (KIT-T698). A check-only job applies its patch, builds and tests in
// a broker-owned git worktree under <target>/broker/check/<repo>; the maintainer's checkout holds landed code only. A landing
// runs its checks there too and writes the live tree only after they passed.
//
//   prepareCheckTree(cfg, repo, { kind }) -> { cfg, cwd } | { error }   (kind 'check' by default; precheck.mjs keeps its own 'precheck' tree)
//     cfg: `cfg` with root moved to the check root, so every join(cfg.root, path) lands in the check tree;
//     cwd: the repo's directory in it, synced to the live checkout's HEAD (a submodule repo: its own HEAD).
//     Submodules of the repo are worktrees of their own repos, at the sha HEAD records for them.
//   A project's `.ai` is linked in (a junction) when the tree does not carry it, so the pre-write gate reads the same config.
//
// The worktree is kept between jobs and reset to the new base, so cargo builds incrementally in it; a fresh one takes the live
// tree's file mtimes (mtime-align.mjs), so its first build is not a cold rebuild of the workspace. Any failure returns
// { error } and the caller runs in the live tree as before.

import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { git, revParse } from './git.mjs';
import { alignMtimes } from './mtime-align.mjs';

const treeRoot = (cfg, repo, kind) => join(cfg.targetDir, 'broker', kind, repo.name);
const isWorktree = (dir) => existsSync(join(dir, '.git'));

function syncWorktree(live, dir, sha) {
  if (isWorktree(dir)) {
    const r = git(['checkout', '-q', '-f', '--detach', sha], dir);
    if (r.code !== 0) return r.err || r.out || 'checkout failed';
    git(['clean', '-fdq'], dir);
    return null;
  }
  git(['worktree', 'prune'], live);
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length) return `${dir} is not empty and not a worktree`;
  const r = git(['worktree', 'add', '-q', '--detach', '--force', dir, sha], live);
  if (r.code !== 0) return r.err || r.out || 'worktree add failed';
  if (revParse(live, 'HEAD') === sha) alignMtimes(live, dir);
  return null;
}

function linkProjectStore(cfg, root) {
  const store = join(cfg.root, '.ai');
  const link = join(root, '.ai');
  if (existsSync(link) || !existsSync(store)) return;
  try { symlinkSync(store, link, 'junction'); } catch { /* the gate then sees an unadopted tree and passes; the live run is unaffected */ }
}

export function prepareCheckTree(cfg, repo, { kind = 'check' } = {}) {
  try {
    const live = join(cfg.root, repo.path);
    const base = revParse(live, 'HEAD');
    if (!base) return { error: `${live} has no HEAD` };
    const root = treeRoot(cfg, repo, kind);
    const cwd = join(root, repo.path);
    const failed = syncWorktree(live, cwd, base);
    if (failed) return { error: failed };
    for (const sub of cfg.repos.filter((r) => r.submodule && !repo.submodule && String(r.pinIn) === String(repo.path))) {
      const recorded = git(['rev-parse', `${base}:${sub.path}`], live).out;
      if (!recorded) continue;
      const subLive = join(cfg.root, sub.path);
      const subDir = join(root, sub.path);
      const subFailed = syncWorktree(subLive, subDir, recorded);
      if (subFailed) return { error: `${sub.path}: ${subFailed}` };
    }
    linkProjectStore(cfg, root);
    return { cfg: { ...cfg, root }, cwd };
  } catch (e) {
    return { error: e.message };
  }
}
