// The shared workflow-data repo (KIT-T230) — claude-kit-data holds EVERY adopted project's
// .ai under `projects/<name>/`, and each project mounts its own subtree as `.ai`.
//
// `git add -A` / `git add .` there is TREE-WIDE regardless of cwd, so one project's turn can
// stage — and publish — another live session's in-flight edits under the wrong label. These
// helpers identify such a repo and attribute paths to their project subtree, so every write
// path can be limited to `projects/<name>/`.

import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { git } from './lib.mjs';

export const DATA_PROJECTS_DIR = 'projects';

// Is `root` the shared data repo? By remote or directory name (`claude-kit-data`), else by
// layout (a `projects/` dir holding at least one project subtree). Fail-open → false.
export function isDataRepo(root) {
  if (!root) return false;
  try {
    if (/claude-kit-data/i.test(git(['-C', root, 'remote', '-v']))) return true;
  } catch {
    /* remote-less repo — fall through to the layout checks */
  }
  if (/claude-kit-data/i.test(basename(String(root)))) return true;
  try {
    return readdirSync(join(root, DATA_PROJECTS_DIR), { withFileTypes: true }).some((e) => e.isDirectory());
  } catch {
    return false;
  }
}

// The distinct `projects/<name>` subtrees a set of repo-relative paths spans.
export function dataProjectsSpanned(paths) {
  const re = new RegExp(`^${DATA_PROJECTS_DIR}/([^/]+)/`);
  const names = new Set();
  for (const p of paths) {
    const m = String(p).replace(/\\/g, '/').match(re);
    if (m) names.add(m[1]);
  }
  return [...names];
}

// The `projects/<name>` pathspec a project's store occupies inside the data repo. git resolves
// it, not string arithmetic on realpaths: `.ai` is a symlink/junction, and git is the consumer
// of the answer, so asking git inside the mount gives the pathspec it will actually match.
// '' when the layout is not the centralized `projects/<name>` one.
export function dataProjectPathspec(projRoot) {
  const rel = git(['rev-parse', '--show-prefix'], join(projRoot, '.ai')).trim().replace(/\/+$/, '');
  return new RegExp(`^${DATA_PROJECTS_DIR}/[^/]+$`).test(rel) ? rel : '';
}
