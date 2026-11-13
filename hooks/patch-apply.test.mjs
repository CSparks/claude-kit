#!/usr/bin/env node
// patch-apply.test.mjs — `git apply`, `git am` and `patch` write the files a hand-authored diff names, so the
// source and store shell gates judge those files (KIT-T1068). Report-only forms and a patch file from elsewhere pass.
// Run: node hooks/patch-apply.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutRedirects } from './lib/lead-command-walk.mjs';
import { patchTargets } from './lib/patch-apply.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('patch-apply');
const HOOKS = fileURLToPath(new URL('.', import.meta.url));
const BLOCK = 2;
const PASS = 0;

const SRC_DIFF = 'diff --git a/src/ui/Main.h b/src/ui/Main.h\n--- a/src/ui/Main.h\n+++ b/src/ui/Main.h\n@@ -1 +1 @@\n-a\n+b\n';
const DOC_DIFF = 'diff --git a/docs/notes.md b/docs/notes.md\n--- a/docs/notes.md\n+++ b/docs/notes.md\n@@ -1 +1 @@\n-a\n+b\n';
const STORE_DIFF = 'diff --git a/.ai/tickets/KIT-T1.md b/.ai/tickets/KIT-T1.md\n--- a/.ai/tickets/KIT-T1.md\n+++ b/.ai/tickets/KIT-T1.md\n@@ -1 +1 @@\n-a\n+b\n';
const DELETE_DIFF = 'diff --git a/src/old.rs b/src/old.rs\n--- a/src/old.rs\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n';
const PLAIN_DIFF = '--- src/a.rs\n+++ src/a.rs\n@@ -1 +1 @@\n-a\n+b\n';
const heredoc = (head, body) => `${head} <<'EOF'\n${body}EOF`;

try {
  const repo = tmpDir('kit-patch-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  const scratch = tmpDir('kit-patch-files-');
  const put = (name, text) => { const p = join(scratch, name); writeFileSync(p, text); return p.replace(/\\/g, '/'); };
  const srcPatch = put('src.patch', SRC_DIFF);
  const docPatch = put('doc.patch', DOC_DIFF);
  const storePatch = put('store.patch', STORE_DIFF);
  const mbox = put('src.mbox', `From abc Mon Sep 17 00:00:00 2001\nSubject: x\n\n---\n${SRC_DIFF}`);
  const longSpelling = realpathSync.native(srcPatch).replace(/\\/g, '/');
  const quoted = (p) => `"${p}"`;

  const elsewhere = tmpDir('kit-patch-temp-');
  const offTemp = { ...process.env, TEMP: elsewhere, TMP: elsewhere, TMPDIR: elsewhere };
  const gate = (name, command, env = process.env) => spawnSync(process.execPath, [join(HOOKS, name)], { cwd: repo, env, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  const src = (command) => gate('source-shell-gate.mjs', command).status;
  const srcOffTemp = (command) => gate('source-shell-gate.mjs', command, offTemp).status;
  const store = (command) => gate('store-shell-gate.mjs', command).status;

  const blocks = [
    ['git apply of a heredoc diff', heredoc('git apply', SRC_DIFF)],
    ['git apply of a heredoc diff through -C', heredoc('git -C . apply', SRC_DIFF)],
    ['git apply of a heredoc diff through --no-pager', heredoc('git --no-pager apply', SRC_DIFF)],
    ['git apply -3 of a heredoc diff', heredoc('git apply -3', SRC_DIFF)],
    ['patch -p1 of a heredoc diff', heredoc('patch -p1', SRC_DIFF)],
    ['patch with a plain header and -p0', heredoc('patch -p0', PLAIN_DIFF)],
    ['patch of a deleting diff', heredoc('patch -p1', DELETE_DIFF)],
    ['a patch written and applied in one command', `cat > ${srcPatch} <<'EOF'\n${SRC_DIFF}EOF\ngit apply ${srcPatch}`],
    ['git apply of a temp patch file (short temp spelling)', `git apply ${srcPatch}`],
    ['git apply of a temp patch file (long spelling)', `git apply ${quoted(longSpelling)}`],
    ['patch -p1 < temp file', `patch -p1 < ${srcPatch}`],
    ['patch -p1 < temp file quoted with the long spelling', `patch -p1 < ${quoted(longSpelling)}`],
    ['patch -p1 -i temp file', `patch -p1 -i ${srcPatch}`],
    ['git am < temp mbox', `git am < ${mbox}`],
    ['a patch named on a printf pipe', "printf '--- a/src/x.h\\n+++ b/src/x.h\\n' | git apply"],
    ['git apply --stat --apply', `git apply --stat --apply ${srcPatch}`],
    ['patch of an original file named as the operand', 'patch src/a.rs < upstream.diff'],
    ['patch -o onto a source file', 'patch -o src/a.rs orig.rs < upstream.diff'],
    ['a chained apply', `git status && git apply ${srcPatch}`],
    ['sudo patch -p1 of a heredoc diff', heredoc('sudo patch -p1', SRC_DIFF)],
    ['env A=1 git apply of a heredoc diff', heredoc('env A=1 git apply', SRC_DIFF)],
    ['a leading assignment before git apply', heredoc('A=1 git apply', SRC_DIFF)],
    ['command git apply of a temp patch', `command git apply ${srcPatch}`],
    ['sudo -n git apply of a temp patch', `sudo -n git apply ${srcPatch}`],
    ['sudo -u root patch -p1 < temp file', `sudo -u root patch -p1 < ${srcPatch}`],
    ['timeout 5 patch -p1 < temp file', `timeout 5 patch -p1 < ${srcPatch}`],
    ['env -i git -C . apply of a temp patch', `env -i git -C . apply ${srcPatch}`],
    ['a path-qualified patch behind sudo', heredoc('sudo /usr/bin/patch -p1', SRC_DIFF)],
    ['cat temp patch | git apply', `cat ${srcPatch} | git apply`],
    ['cat temp patch (long spelling, quoted) | git apply', `cat ${quoted(longSpelling)} | git apply`],
    ['cat temp patch | patch -p1', `cat ${srcPatch} | patch -p1`],
    ['cat temp mbox | git am', `cat ${mbox} | git am`],
    ['cat temp patch | sudo git apply', `cat ${srcPatch} | sudo git apply`],
  ];
  for (const [name, command] of blocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);

  const passes = [
    ['git apply --check', `git apply --check ${srcPatch}`],
    ['git apply --stat of a heredoc', heredoc('git apply --stat', SRC_DIFF)],
    ['git apply --numstat', `git apply --numstat ${srcPatch}`],
    ['git apply --summary', `git apply --summary ${srcPatch}`],
    ['git apply --cached (the index only)', `git apply --cached ${srcPatch}`],
    ['patch --dry-run', `patch --dry-run -p1 < ${srcPatch}`],
    ['git am --abort', 'git am --abort'],
    ['a patch file the gate cannot read (not a temp file)', 'git apply vendor/upstream.patch'],
    ['a temp patch that names no source file', `git apply ${docPatch}`],
    ['a heredoc diff that names no source file', heredoc('git apply', DOC_DIFF)],
    ['a diff piped from git', 'git diff | git apply -R'],
    ['a stash diff piped from git', 'git stash show -p | git apply'],
    ['a commit message that mentions git apply', 'git commit -m "document git apply and patch usage"'],
    ['a log filtered for apply', 'git log --oneline | grep apply'],
    ['git checkout <rev> -- <path> (restores committed content)', 'git checkout stash@{0} -- src/ui/Main.h'],
    ['git restore of a source file', 'git restore src/ui/Main.h'],
    ['sudo git apply --check', `sudo git apply --check ${srcPatch}`],
    ['env A=1 git apply --stat of a heredoc', heredoc('env A=1 git apply --stat', SRC_DIFF)],
    ['command git apply --cached', `command git apply --cached ${srcPatch}`],
    ['sudo patch --dry-run', `sudo patch --dry-run -p1 < ${srcPatch}`],
    ['cat temp patch | git apply --check', `cat ${srcPatch} | git apply --check`],
    ['cat temp patch | git apply --stat', `cat ${srcPatch} | git apply --stat`],
    ['cat temp patch that names no source | git apply', `cat ${docPatch} | git apply`],
    ['git am --abort behind sudo', 'sudo git am --abort'],
    ['command -v git', 'command -v git'],
    ['sudo git status', 'sudo git status'],
    ['echo the word patch', 'echo patch the src tree'],
    ['grep for the word patch', 'grep -n patch src/ui/Main.h'],
    ['env printing git apply in a string', 'env A=1 echo "git apply"'],
    ['cat of a temp patch that is not applied', `cat ${srcPatch} | wc -l`],
  ];
  for (const [name, command] of passes) ok(`source gate passes ${name}`, src(command) === PASS);

  const outside = put('outside.patch', SRC_DIFF);
  const outsideDoc = put('outside-doc.patch', DOC_DIFF);
  ok('source gate blocks a patch saved outside the temp dir', srcOffTemp(`git apply ${outside}`) === BLOCK);
  ok('source gate blocks an outside patch behind sudo < redirect', srcOffTemp(`sudo patch -p1 < ${outside}`) === BLOCK);
  ok('source gate blocks an outside patch piped to git apply', srcOffTemp(`cat ${outside} | git apply`) === BLOCK);
  ok('source gate off-temp negative control: an outside patch that names no source', srcOffTemp(`git apply ${outsideDoc}`) === PASS);
  ok('source gate off-temp negative control: git apply --check of an outside source patch', srcOffTemp(`git apply --check ${outside}`) === PASS);
  ok('source gate off-temp negative control: an unreadable patch', srcOffTemp('git apply no/such/upstream.patch') === PASS);

  ok('store gate blocks a patch file that names a store item', store(`git apply ${storePatch}`) === BLOCK);
  ok('store gate blocks a heredoc diff that names a store item', store(heredoc('git apply', STORE_DIFF)) === BLOCK);
  ok('store gate negative control: a source diff is not a store write', store(heredoc('git apply', SRC_DIFF)) === PASS);
  ok('store gate negative control: git apply --check of a store diff', store(`git apply --check ${storePatch}`) === PASS);

  const names = (text, strip) => patchTargets(text, strip).join(',');
  ok('patchTargets: git headers, one prefix stripped', names(SRC_DIFF, 1) === 'src/ui/Main.h');
  ok('patchTargets: a deleted file is a target, /dev/null is not', names(DELETE_DIFF, 1) === 'src/old.rs');
  ok('patchTargets: no diff, no target', names('echo hi', 1) === '');
  ok('withoutRedirects drops a heredoc and a file redirect', withoutRedirects("patch -p1 <<'EOF' > out 2>&1").trim() === 'patch -p1');
} finally {
  cleanup();
}
done();
