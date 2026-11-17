// restore-tree (KIT-T1340): the verb that puts directories back to a revision, removes what the revision lacks, and returns.
// Run: node scripts/restore-tree.test.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, git, identify, reporter, repo, script } from '../hooks/test-harness.mjs';
import { emptiedParents, planRestore } from './restore-tree/plan.mjs';
import { restoreTree } from './restore-tree.mjs';

const { ok, done } = reporter('restore-tree');

const sink = () => { const chunks = []; return { write: (s) => chunks.push(s), text: () => chunks.join('') }; };

// A repo with two commits. Old: old.rs, shared.rs v1, sub/gone.rs. Head: shared.rs v2, sub/new.rs, and no old.rs or sub/gone.rs.
function history() {
  const dir = identify(repo());
  const put = (name, text) => { mkdirSync(join(dir, name, '..'), { recursive: true }); writeFileSync(join(dir, name), text); };
  put('crates/a/old.rs', 'fn old() {}\n');
  put('crates/a/shared.rs', 'fn shared_v1() {}\n');
  put('crates/a/sub/gone.rs', 'fn gone() {}\n');
  put('crates/b/other.rs', 'fn other() {}\n');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'old'], dir);
  const old = git(['rev-parse', 'HEAD'], dir).trim();
  git(['rm', '-q', 'crates/a/old.rs', 'crates/a/sub/gone.rs'], dir);
  put('crates/a/shared.rs', 'fn shared_v2() {}\n');
  put('crates/a/sub/new.rs', 'fn new() {}\n');
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', 'head'], dir);
  const at = (name) => join(dir, name);
  const run = (args, cwd = dir) => { const out = sink(); const err = sink(); const code = restoreTree(args, { out, err, cwd }); return { code, out: out.text(), err: err.text() }; };
  return { dir, old, put, at, read: (name) => readFileSync(at(name), 'utf8').replace(/\r\n/g, '\n'), has: (name) => existsSync(at(name)), run, status: (...paths) => git(['status', '--porcelain', '--untracked-files=all', '--', ...paths], dir).trim() };
}

try {
  const plan = planRestore({
    target: new Map([['d/a', '1'], ['d/b', '2'], ['d/c', '3']]),
    disk: new Set(['d/b', 'd/c', 'd/x', 'd/y', 'd/z']),
    tracked: new Set(['d/b', 'd/c', 'd/y']),
    matchesTarget: (p) => p === 'd/b',
    recoverable: new Set(['d/x']),
  });
  ok('plan: a missing revision file is written, a matching one skipped, an unrecoverable different one refused',
    plan.write.join() === 'd/a' && plan.refuse.some((r) => r.path === 'd/c'));
  ok('plan: a recoverable stray is removed, an unrecoverable tracked one refused, an unrecoverable untracked one left',
    plan.remove.join() === 'd/x' && plan.refuse.some((r) => r.path === 'd/y') && plan.leave.join() === 'd/z');
  ok('emptiedParents names the directories below the given roots, deepest first, never a root',
    emptiedParents(['crates/a/sub/deep/x.rs', 'crates/a/y.rs'], ['crates/a']).join() === 'crates/a/sub/deep,crates/a/sub');

  const h = history();
  const forward = h.run([h.old, 'crates/a']);
  ok('forward: the revision files are written and the files it lacks are removed', forward.code === 0
    && h.read('crates/a/old.rs') === 'fn old() {}\n' && h.read('crates/a/shared.rs') === 'fn shared_v1() {}\n'
    && h.has('crates/a/sub/gone.rs') && !h.has('crates/a/sub/new.rs'), forward.err);
  ok('forward: the index is untouched (nothing staged)', git(['diff', '--cached', '--name-only'], h.dir).trim() === '');
  ok('forward: a directory outside the arguments is untouched', h.read('crates/b/other.rs') === 'fn other() {}\n');
  ok('forward: the receipt counts the work and names the way back', /3 written, 1 removed/.test(forward.out) && /restore-tree --back crates\/a/.test(forward.out), forward.out);
  const second = h.run([h.old, 'crates/a']);
  ok('forward again to the same revision changes nothing', second.code === 0 && /0 written, 0 removed/.test(second.out), second.out + second.err);

  const back = h.run(['--back', 'crates/a']);
  ok('--back: the directory is HEAD again, the strays gone, git status clean', back.code === 0 && h.status('crates/a') === ''
    && !h.has('crates/a/old.rs') && !h.has('crates/a/sub/gone.rs') && h.read('crates/a/sub/new.rs') === 'fn new() {}\n', back.err + h.status('crates/a'));
  ok('--back removes the directories the strays emptied', (h.run([h.old, 'crates/a']), h.run(['--back', 'crates/a']), true) && h.status('crates/a') === '');

  const raw = history();
  git(['checkout', raw.old, '--', 'crates/a'], raw.dir);
  ok('a raw git checkout <rev> -- <dir> stages the old-only files and leaves the files HEAD removed on disk',
    raw.status('crates/a').includes('A  crates/a/old.rs') && raw.has('crates/a/old.rs') && raw.has('crates/a/sub/new.rs'));
  const rawBack = raw.run(['--back', 'crates/a']);
  ok('--back after the raw checkout: the staged strays leave the disk AND the index, status and the staged diff are empty', rawBack.code === 0
    && raw.status('crates/a') === '' && git(['diff', '--cached', '--name-only'], raw.dir).trim() === '' && !raw.has('crates/a/old.rs'), rawBack.err + raw.status('crates/a'));

  const unstaged = history();
  git(['checkout', unstaged.old, '--', 'crates/a'], unstaged.dir);
  git(['reset', '-q'], unstaged.dir);
  ok('the same strays left untracked (the index reset) are removed too', unstaged.status('crates/a').includes('?? crates/a/old.rs')
    && unstaged.run(['--back', 'crates/a']).code === 0 && unstaged.status('crates/a') === '');

  const staged = history();
  staged.put('crates/a/staged-new.rs', 'fn staged_new() {}\n');
  git(['add', 'crates/a/staged-new.rs'], staged.dir);
  const keepStaged = staged.run(['--back', 'crates/a']);
  ok('negative control: another writer\'s staged new file, in no commit, refuses the run and stays staged', keepStaged.code === 1
    && /staged-new\.rs/.test(keepStaged.err) && staged.read('crates/a/staged-new.rs') === 'fn staged_new() {}\n' && git(['diff', '--cached', '--name-only'], staged.dir).trim() === 'crates/a/staged-new.rs');

  const stagedEdit = history();
  stagedEdit.put('crates/a/shared.rs', 'fn staged_only() {}\n');
  git(['add', 'crates/a/shared.rs'], stagedEdit.dir);
  stagedEdit.put('crates/a/shared.rs', 'fn shared_v1() {}\n');
  const keepEdit = stagedEdit.run(['--back', 'crates/a']);
  ok('negative control: a staged blob no commit holds is not discarded by an index reset: refused, worktree and index unchanged', keepEdit.code === 1
    && /shared\.rs.*staged change/.test(keepEdit.err) && stagedEdit.read('crates/a/shared.rs') === 'fn shared_v1() {}\n'
    && git(['show', ':crates/a/shared.rs'], stagedEdit.dir).replace(/\r\n/g, '\n') === 'fn staged_only() {}\n');

  const stagedStray = history();
  stagedStray.put('crates/a/old.rs', 'fn staged_new() {}\n');
  git(['add', 'crates/a/old.rs'], stagedStray.dir);
  stagedStray.put('crates/a/old.rs', 'fn old() {}\n');
  const keepStray = stagedStray.run(['--back', 'crates/a']);
  ok('negative control: a staged new file whose index blob no commit holds is not dropped even when its bytes on disk are committed', keepStray.code === 1
    && /old\.rs.*staged change/.test(keepStray.err) && stagedStray.has('crates/a/old.rs')
    && git(['diff', '--cached', '--name-only'], stagedStray.dir).trim() === 'crates/a/old.rs');

  const large = history();
  large.put('crates/a/golden.bin', 'x'.repeat(3 * (1 << 19)));
  git(['add', '-A'], large.dir);
  git(['commit', '-q', '-m', 'golden data'], large.dir);
  const toOld = large.run([large.old, 'crates/a']);
  ok('a clean tracked file over 1 MiB neither refuses the run nor survives a restore to a revision without it', toOld.code === 0 && !large.has('crates/a/golden.bin'), toOld.err);
  ok('--back brings the large file again, status clean', large.run(['--back', 'crates/a']).code === 0 && large.has('crates/a/golden.bin') && large.status('crates/a') === '');

  const chain = history();
  chain.run([chain.old, 'crates/a']);
  const toHead = chain.run(['HEAD', 'crates/a']);
  ok('a second forward step needs no --back in between: naming HEAD is the same as --back', toHead.code === 0 && chain.status('crates/a') === '');

  const dry = history();
  const preview = dry.run(['--dry-run', dry.old, 'crates/a']);
  ok('--dry-run lists the plan and changes nothing', preview.code === 0 && /dry run/.test(preview.out) && /remove crates\/a\/sub\/new\.rs/.test(preview.out) && dry.status('crates/a') === '');

  const edited = history();
  edited.put('crates/a/shared.rs', 'fn uncommitted_work() {}\n');
  const refusedEdit = edited.run([edited.old, 'crates/a']);
  ok('negative control: an uncommitted edit refuses the whole run and every file stays', refusedEdit.code === 1
    && /crates\/a\/shared\.rs/.test(refusedEdit.err) && edited.read('crates/a/shared.rs') === 'fn uncommitted_work() {}\n' && !edited.has('crates/a/old.rs') && edited.has('crates/a/sub/new.rs'));

  const replaced = history();
  replaced.put('crates/a/old.rs', 'fn my_new_old() {}\n');
  const refusedReplace = replaced.run([replaced.old, 'crates/a']);
  ok('negative control: an unsaved untracked file at a revision path is refused, never overwritten', refusedReplace.code === 1
    && replaced.read('crates/a/old.rs') === 'fn my_new_old() {}\n' && replaced.has('crates/a/sub/new.rs'));

  const newWork = history();
  newWork.put('crates/a/brand-new.rs', 'fn brand_new() {}\n');
  const keeps = newWork.run([newWork.old, 'crates/a']);
  const returned = newWork.run(['--back', 'crates/a']);
  ok('negative control: an untracked file no commit holds is left in place, forward and back', keeps.code === 0 && /left alone/.test(keeps.out)
    && returned.code === 0 && newWork.read('crates/a/brand-new.rs') === 'fn brand_new() {}\n');

  const stagedAway = history();
  stagedAway.put('crates/a/sub/new.rs', 'fn changed() {}\n');
  ok('negative control: a changed tracked file no commit holds is refused for a delete too', stagedAway.run([stagedAway.old, 'crates/a']).code === 1 && stagedAway.read('crates/a/sub/new.rs') === 'fn changed() {}\n');

  const odd = history();
  ok('refuses a directory outside the repository', odd.run([odd.old, join(odd.dir, '..')]).code === 1);
  ok('refuses the repository root', odd.run([odd.old, '.']).code === 1);
  ok('refuses a directory inside .git', odd.run([odd.old, '.git']).code === 1);
  ok('refuses a revision that names no commit', odd.run(['no-such-rev', 'crates/a']).code === 1);
  ok('refuses a revision spelled as an option', odd.run(['-fx', 'crates/a']).code === 1);
  ok('refuses an unknown option and a missing directory', odd.run(['--force', odd.old, 'crates/a']).code === 1 && odd.run([odd.old]).code === 1 && odd.run(['--back']).code === 1);
  ok('a relative directory resolves against the working directory', odd.run([odd.old, 'a'], join(odd.dir, 'crates')).code === 0 && odd.has('crates/a/old.rs'));

  const cli = history();
  const viaNode = script('restore-tree.mjs', [cli.old, 'crates/a'], cli.dir);
  ok('the script runs as a program and exits 0', viaNode.code === 0 && cli.has('crates/a/old.rs'), viaNode.err);
} finally {
  cleanup();
}

done();
