#!/usr/bin/env node
// source-shell-gate-discard.test.mjs — `git clean`, `git rm -f`, `git stash -u`, `git checkout -- <path>`, `git restore` and
// `git reset --hard` delete, hide or overwrite files the way `rm` does, so the source gate judges them the same way
// (KIT-T1163): a named file passes only when this caller wrote it; a call that may take unnamed files, and any git call
// outside the allow-list (git-call-policy.mjs: built-in subcommand, short option and config lists, no environment change),
// passes only while no other writer is live in the checkout. A plain `git rm`, a dry run and a stash action that only reads or
// restores an entry stay allowed; a stash, `git pull` and `git rebase` are sweeps, and any `--autostash` is refused (KIT-T1266).
// This file judges the named-file forms; the sweeps are source-shell-gate-discard-sweeps.test.mjs and the everyday calls beside
// a live writer source-shell-gate-discard-live.test.mjs, split so each finishes inside one foreground call (KIT-T1246).
// Run: node hooks/source-shell-gate-discard.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { discardHarness } from './source-shell-gate-discard-harness.mjs';

const { check, git, toolWrite, passes_, stops, freshHolders, seed, finish } = discardHarness();

try {
  seed();

  // git clean, named files: judged like rm.
  check('clean -f -- an untracked file the caller wrote passes', passes_('git clean -f -- mine.rs'));
  check('clean -f of it without -- passes', passes_('git clean -f mine.rs'));
  check("clean -f -- another writer's file is blocked", stops('git clean -f -- theirs.rs'));
  check("clean -f without -- of another writer's file is blocked", stops('git clean -f theirs.rs'));
  check('clean -f -- a file no tool wrote is blocked', stops('git clean -f -- never-ledgered.rs'));
  check('the writing session itself may clean its file', passes_('git clean -f -- theirs.rs', 'S2'));
  check('a caller without a session id is blocked', stops('git clean -f -- mine.rs', ''));
  check('clean -fx -- another writer\'s file is blocked', stops('git clean -fx -- theirs.rs'));
  check('clean names the file through -C', stops('git -C sub clean -f -- theirs.rs'));
  check('clean -n (dry run) of it passes', passes_('git clean -n -- theirs.rs'));
  check('clean -fdn (bundled dry run) passes', passes_('git clean -fdn'));
  check('clean --dry-run passes', passes_('git clean -f --dry-run -- theirs.rs'));
  check('clean -e takes a pattern, not a path', passes_("git clean -f -e '*.rs' -- mine.rs"));
  check('clean -f -- a tracked file removes nothing and passes', passes_('git clean -f -- tracked.rs'));
  check('clean -f -- a non-source file passes', passes_('git clean -f -- notes.txt'));
  check('a variable the command assigns resolves: own file passes', passes_('F=mine.rs; git clean -f -- "$F"'));
  check("a variable the command assigns resolves: another writer's file is blocked", stops('F=theirs.rs; git clean -f -- "$F"'));
  check("sudo git clean of another writer's file is blocked", stops('sudo git clean -f -- theirs.rs'));
  check("a bash -c string with git clean of another writer's file is blocked", stops('bash -c "git clean -f -- theirs.rs"'));
  check("a chained git clean of another writer's file is blocked", stops('echo ok && git clean -f -- theirs.rs'));
  check('git -c k=v clean is read past the option', stops('git -c core.x=1 clean -f -- theirs.rs'));

  // git rm: plain stays the documented way to delete a tracked file; -f is judged.
  check('plain git rm of a tracked file passes', passes_('git rm -- tracked.rs'));
  check('plain git rm of a tracked file with local changes passes (git refuses it itself)', passes_('git rm -- dirty.rs'));
  check('git rm -f of a tracked file identical to HEAD passes', passes_('git rm -f -- tracked.rs'));
  check("git rm -f of a tracked file carrying another writer's changes is blocked", stops('git rm -f -- dirty.rs', 'S2'));
  check('git rm -f of a tracked file carrying the caller\'s own changes passes', passes_('git rm -f -- dirty.rs', 'S1'));
  check('git rm --force is judged the same', stops('git rm --force -- dirty.rs', 'S2'));
  check('git rm -rf of a tracked file with changes is judged the same', stops('git rm -rf dirty.rs', 'S2'));
  check('git rm --cached -f removes no file and passes', passes_('git rm --cached -f -- dirty.rs', 'S2'));
  check('git rm -n -f is a dry run and passes', passes_('git rm -n -f -- dirty.rs', 'S2'));
  check("git rm -f of another writer's untracked file is blocked", stops('git rm -f -- theirs.rs'));

  // git stash: every push, save or bare stash is judged; with no other writer live these pass.
  check('plain git stash passes', passes_('git stash'));
  check('git stash push -m passes', passes_('git stash push -m wip'));
  check('git stash pop and list pass', passes_('git stash pop') && passes_('git stash list'));
  check("git stash push -u -- another writer's file is blocked", stops('git stash push -u -- theirs.rs'));
  check('git stash push -u -- the caller\'s own file passes', passes_('git stash push -u -- mine.rs'));
  check('git stash push -u with -m names its pathspec after --', stops('git stash push -u -m wip -- theirs.rs'));

  // An ambiguous line that runs a discard is refused like any ambiguous write; one that does not, passes.
  freshHolders();
  check('an ambiguous quoting line with git clean is blocked', stops("echo it's; git clean -fd"));
  check('an ambiguous quoting line with git stash -u is blocked', stops("echo it's; git stash -u"));
  check('KIT-T1266: an ambiguous quoting line with a plain git stash is blocked too', stops("echo it's; git stash"));
  check('KIT-T1266 control: an ambiguous quoting line with git stash list passes', passes_("echo it's; git stash list"));

  // KIT-T1539: git puts a stashed file back with CRLF endings (core.autocrlf), yet the caller's own text is still its own.
  git('config', 'core.autocrlf', 'true');
  const AGENT = 'agentA1234567890';
  toolWrite('popped.rs', 'fn popped() {}\nfn again() {}\n', 'S1', AGENT);
  git('stash', 'push', '-u', '--', 'popped.rs');
  git('stash', 'pop');
  check("KIT-T1539: a second stash of the caller's own file after a stash and pop passes", passes_('git stash push -u -- popped.rs', 'S1', AGENT));
  check('KIT-T1539 control: the same restored file is still blocked for another writer', stops('git stash push -u -- popped.rs', 'S2'));
  writeFileSync(join(git('rev-parse', '--show-toplevel'), 'popped.rs'), 'fn other() {}\r\n');
  check('KIT-T1539 control: a file rewritten after the pop is blocked', stops('git stash push -u -- popped.rs', 'S1', AGENT));
} finally {
  finish();
}
