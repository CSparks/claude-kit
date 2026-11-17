#!/usr/bin/env node
// restore-tree.mjs — the sanctioned way to look at a directory as an older revision had it, and to come back (KIT-T1340).
// `git checkout <rev> -- <dir>` copies the old files but leaves the files the old revision lacks, and the strays it adds
// are untracked source a shell delete may not remove. This verb restores the directories to the revision exactly: files the
// revision holds are written, files it lacks are removed, and `--back` returns the directories to HEAD the same way.
//
//   restore-tree <rev> <dir> [<dir> ...]         put each directory as <rev> had it
//   restore-tree --back <dir> [<dir> ...]        put each directory as HEAD has it (removes the files only an older <rev> had)
//   --dry-run                                    print the plan and change nothing
//
// Only files git knows are written or removed, and only when no byte is lost: a file whose bytes differ from the target
// passes only when HEAD or a commit reachable from HEAD, a branch, a tag or a remote holds those bytes at that path
// (hooks/lib/history-blobs.mjs). Any other change inside the directories (an uncommitted edit, an unsaved new file that
// replaces a revision file) refuses the whole run before anything changes, naming the files. An untracked file no commit
// holds that the revision lacks is left where it is. Going to an older revision leaves the index alone, so a commit of staged
// files holds no bisect state; going to HEAD also sets the index entries of the files it writes to HEAD's and drops the entries
// a raw `git checkout <rev> -- <dir>` staged for files HEAD lacks. Ignored files and
// submodule entries are left alone. The shell gates read a call of this verb as git restoring committed content
// (hooks/lib/restore-tree-call.mjs). Exit 0 done, 1 refused or failed.

import { isMain } from './is-main.mjs';
import { emptiedParents, planRestore } from './restore-tree/plan.mjs';
import { checkout, commitOf, diskFiles, dropStaged, recoverablePaths, removeFiles, repoPaths, sameBytes, trackedFiles, treeBlobs, treeRoot } from './restore-tree/repo.mjs';

const SHOWN = 20;
const USAGE = 'usage: restore-tree [--dry-run] <rev> <dir> [<dir> ...]   |   restore-tree [--dry-run] --back <dir> [<dir> ...]';

function parse(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const unknown = [...flags].filter((f) => f !== '--back' && f !== '--dry-run');
  if (unknown.length) throw new Error(`unknown option ${unknown[0]}; ${USAGE}`);
  const words = argv.filter((a) => !a.startsWith('--'));
  const back = flags.has('--back');
  const [rev, dirs] = back ? ['HEAD', words] : [words[0], words.slice(1)];
  if (!rev || !dirs.length) throw new Error(USAGE);
  return { rev, dirs, back, dryRun: flags.has('--dry-run') };
}

const shown = (items) => items.slice(0, SHOWN).map((i) => `  ${i}`).concat(items.length > SHOWN ? [`  +${items.length - SHOWN} more`] : []);

function planFor(root, commit, paths) {
  const target = treeBlobs(root, commit, paths);
  const disk = diskFiles(root, paths);
  const tracked = trackedFiles(root, paths);
  const touched = [...disk].filter((p) => !target.has(p) || !sameBytes(root, p, target.get(p)));
  return { ...planRestore({ target, disk, tracked, matchesTarget: (p) => sameBytes(root, p, target.get(p)), recoverable: recoverablePaths(root, touched) }), tracked };
}

export function restoreTree(argv, { out = process.stdout, err = process.stderr, cwd = process.cwd() } = {}) {
  try {
    const { rev, dirs, back, dryRun } = parse(argv);
    const root = treeRoot(cwd);
    const paths = repoPaths(root, cwd, dirs);
    const commit = commitOf(root, rev);
    const plan = planFor(root, commit, paths);
    if (plan.refuse.length) {
      err.write(`restore-tree: refused, nothing changed: no commit holds the bytes of ${plan.refuse.length} file(s), so the restore would destroy them:\n${shown(plan.refuse.map((r) => `${r.path}  (${r.why})`)).join('\n')}\n  Commit them (or move them out of ${paths.join(', ')}), then run it again.\n`);
      return 1;
    }
    const summary = `${plan.write.length} written, ${plan.remove.length} removed, ${plan.leave.length} left (untracked, in no commit)`;
    const label = back ? 'back at HEAD' : `at ${commit.slice(0, 10)}`;
    if (dryRun) {
      out.write(`restore-tree (dry run, nothing changed): ${paths.join(', ')} ${label}: ${summary}\n${shown([...plan.write.map((p) => `write ${p}`), ...plan.remove.map((p) => `remove ${p}`)]).join('\n')}\n`);
      return 0;
    }
    const atHead = commit === commitOf(root, 'HEAD');
    removeFiles(root, plan.remove, emptiedParents(plan.remove, paths));
    if (atHead) dropStaged(root, plan.remove, plan.tracked);
    checkout(root, commit, plan.write, { alsoIndex: atHead });
    out.write(`restore-tree: ${paths.join(', ')} ${label}: ${summary}\n${plan.leave.length ? `left alone:\n${shown(plan.leave).join('\n')}\n` : ''}${back ? '' : '  return them with: restore-tree --back ' + dirs.join(' ') + '\n'}`);
    return 0;
  } catch (e) {
    err.write(`restore-tree: ${e.message}\n`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(restoreTree(process.argv.slice(2)));
