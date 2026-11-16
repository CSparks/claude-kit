#!/usr/bin/env node
// source-shell-gate-discard-live.test.mjs — beside a live writer the everyday git calls still pass, the block of an
// off-list call names the part and the way out, a discard of a changed file is judged by who changed it, and a stash,
// pull or rebase is a sweep (KIT-T1163, KIT-T1266). The discard suites are split so that each finishes inside one foreground
// call (KIT-T1246).
// Run: node hooks/source-shell-gate-discard-live.test.mjs

import { beatHolder, claimFile } from './lib/checkout-holder.mjs';
import { discardHarness } from './source-shell-gate-discard-harness.mjs';

const h = discardHarness();
const { check, run, blocked, passes_, stops, stops_ps, freshHolders, finish } = h;

try {
  h.seed({ aliases: true });

  freshHolders();
  claimFile({ tree: h.top, session: 'S1', agent: 'A', label: 'self', rel: 'mine.rs', head: 'h' });
  check("the caller's own live claim is no other writer", passes_('git clean -fd', 'S1', 'A'));
  check('a writer that only ever claimed is not a second writer to itself', passes_('git stash -u', 'S1', 'A'));

  freshHolders();
  claimFile({ tree: h.top, session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
  const everyday = ['git status --short', 'git log -1', 'git diff HEAD', 'git add .', 'git commit -m wip', 'git commit -F msg.txt', 'git push', 'git fetch', 'git show HEAD',
    'git rev-parse HEAD', 'git ls-tree HEAD', 'git ls-files', 'git mv tracked.rs moved.rs', 'git checkout -- tracked.rs', 'git checkout main', 'git checkout -b feature',
    'git submodule status', 'git submodule update --init', 'git branch', 'git config --get user.name', 'git remote -v', 'git -C sub log', 'git -c core.quotepath=off status',
    'git -c user.name=t -c user.email=t@t commit -m x', 'git -c color.ui=never diff', 'git -c advice.detachedHead=false checkout main', 'git --no-pager log', 'git -P log',
    'git --no-optional-locks status', 'git restore --staged tracked.rs', 'git reset --soft HEAD~1', 'git reset', 'git ls-remote .', 'git check-ignore x', 'git notes list',
    'git -c commit.gpgsign=false commit -m x', 'git -c core.autocrlf=false add .', 'git log && git status', 'F=msg.txt; git commit -F "$F"', 'cd sub && git status'];
  for (const command of everyday) check(`control: ${command} passes beside a live writer`, passes_(command));
  check('control: a config read beside a built-in command passes', passes_('git config --get user.name && git commit -m wip'));
  check('KIT-T1266: a config change stops beside a live writer: agents have no need to change shared git configuration', stops('git config user.name x && git commit -m wip'));
  check('control: a git call with no subcommand runs nothing and passes', passes_('git --version') && passes_('git'));
  const blockText = run('git frobnicate', 'S1').stderr;
  check('the block of an unknown subcommand names the part and the way out', /outside the allow-list[^]*git frobnicate, which is not a built-in[^]*written plainly/.test(blockText), blockText);
  check('the block of an environment prefix names it', /HOME= in front of git/.test(run('HOME=/x git status', 'S1').stderr));
  check('the block of an option names it', /global option --git-dir=\.git/.test(run('git --git-dir=.git status', 'S1').stderr));
  check('the block of a config key names it', /git config key core\.pager given with -c/.test(run('git -c core.pager=x log', 'S1').stderr));
  check('PowerShell: an environment change before a git call is refused', stops_ps("$env:PATH = 'x'; git status"));
  check('PowerShell: a plain git call passes', !blocked(run('git status', 'S1', '', 'PowerShell')));
  check('PowerShell: a PowerShell variable is no environment change', !blocked(run("$f = 'msg.txt'; git commit -F $f", 'S1', '', 'PowerShell')));
  check('a discard of a file the caller wrote through checkout passes', passes_('git checkout -- dirty.rs', 'S1'));
  check("a checkout -- of a file with another writer's changes is blocked", stops('git checkout -- dirty.rs', 'S2'));
  check('a checkout with a revision and -- is judged the same', stops('git checkout HEAD -- dirty.rs', 'S2'));
  check('a checkout of an existing path without -- is judged the same', stops('git checkout dirty.rs', 'S2'));
  check("a restore of a file with another writer's changes is blocked for a subagent", stops('git restore dirty.rs', 'S2', 'subAgent1'));
  check("KIT-T1286: the main thread may restore it when no live writer holds it (the named plain form)", passes_('git restore -- dirty.rs', 'S2'));
  check('a restore of the caller\'s own changes passes', passes_('git restore dirty.rs', 'S1'));
  check('a restore --source of a file with another writer\'s changes is blocked', stops('git restore --source=HEAD~1 dirty.rs', 'S2'));
  check('a restore -S -W writes the work tree and is judged', stops('git restore -S -W dirty.rs', 'S2'));
  check('control: a restore --staged touches no file and passes', passes_('git restore --staged dirty.rs', 'S2'));
  check('a plain git rm still passes beside a live writer', passes_('git rm -- tracked.rs'));
  check('KIT-T1266: a plain git stash stops beside a live writer: it moves every writer\'s tracked changes', stops('git stash') && stops('git stash push -m wip') && stops('git stash save wip'));
  check('KIT-T1266 control: the stash actions that only read or restore an entry pass beside a live writer', passes_('git stash list') && passes_('git stash show') && passes_('git stash pop') && passes_('git stash apply') && passes_('git stash drop'));
  check('a dry run still passes beside a live writer', passes_('git clean -nd'));
  check('a named non-source file still passes beside a live writer', passes_('git clean -f -- notes.txt'));
  check('a sibling agent of the same session is another writer', stops('git clean -fd', 'S9', 'B'));
  check('the main thread of that session is another writer to its agent', stops('git clean -fd', 'S9', 'A'));
  check('the live writer itself is no other writer', passes_('git clean -fd', 'S9', ''));

  freshHolders();
  beatHolder({ tree: h.top, session: 'S5-held', label: 'holder' });
  check('a live holder of another session counts too', stops('git clean -fd', 'S5'));
  check('a holder is no other writer to itself', passes_('git clean -fd', 'S5-held'));
} finally {
  finish();
}
