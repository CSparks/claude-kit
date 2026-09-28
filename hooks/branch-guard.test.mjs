// branch-guard (KIT-D039, KIT-T082): every way to make a second branch or checkout blocks —
// switch/checkout off main, branch create/rename, worktree add, clones of or beside a project;
// read-only git, the way back to main, file restores and worktree cleanup pass; only the
// [maintainer-asked-branch: …] token escapes. Wiring is asserted from hooks.json.
// Run: node hooks/branch-guard.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { HOOKS, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('branch-guard');

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const bgEntry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('branch-guard')));
  ok('wired into hooks.json for Bash AND PowerShell (KIT-T082)',
    !!bgEntry && /\bBash\b/.test(bgEntry.matcher) && /\bPowerShell\b/.test(bgEntry.matcher));

  const parent = tmpDir('kit-bg-parent-');
  const bg = join(parent, 'proj');
  mkdirSync(join(bg, '.ai'), { recursive: true });
  git(['init', '-q'], bg);
  identify(bg);
  writeFileSync(join(bg, 'f.txt'), 'x\n');
  git(['add', '-A'], bg);
  git(['commit', '-q', '-m', 'seed'], bg);
  git(['branch', 'feature-x'], bg);
  git(['remote', 'add', 'origin', 'https://github.com/CSparks/proj.git'], bg);
  const trunk = git(['branch', '--show-current'], bg).trim();
  const run = (command, cwd = bg) => hook('branch-guard.mjs', { tool_input: { command } }, cwd);
  const blocks = (command, cwd) => run(command, cwd).code === 2;

  const msg = run('git switch feature-x').out;
  ok('block message cites KIT-D039 and the only escape', msg.includes('KIT-D039') && msg.includes('[maintainer-asked-branch:'));
  ok('block message never steers to a worktree', !/git worktree add|isolation/i.test(msg));

  ok('git switch <branch> blocks', blocks('git switch feature-x'));
  ok('git switch -c <new> blocks', blocks('git switch -c another'));
  ok('git checkout -b <new> blocks', blocks('git checkout -b brand-new'));
  ok('git checkout -B <new> blocks', blocks('git checkout -B brand-new'));
  ok('git checkout <existing-branch> blocks', blocks('git checkout feature-x'));
  ok('git branch <new> blocks', blocks('git branch side-quest'));
  ok('git branch -m <new> blocks', blocks('git branch -m renamed'));
  ok('git worktree add blocks', blocks('git worktree add ../wt -b feature-y'));
  ok('git -C <dir> worktree add blocks', blocks(`git -C "${bg}" worktree add ../wt2`, parent));
  ok('chained segment (… && git worktree add) blocks', blocks('git status && git worktree add ../wt3'));

  ok(`git switch ${trunk} (the way back) is allowed`, !blocks(`git switch ${trunk}`));
  ok(`git checkout ${trunk} is allowed`, !blocks(`git checkout ${trunk}`));
  ok('file-restore checkout (-- file) is allowed', !blocks('git checkout -- f.txt'));
  ok('checkout of a non-branch path is allowed', !blocks('git checkout f.txt'));
  ok('git branch (listing) is allowed', !blocks('git branch'));
  ok('git branch -a / --list / --show-current are allowed',
    !blocks('git branch -a') && !blocks('git branch --list "feat*"') && !blocks('git branch --show-current'));
  ok('git branch -d <old> (cleanup) is allowed', !blocks('git branch -d feature-x'));
  ok('git worktree list / remove / prune are allowed',
    !blocks('git worktree list') && !blocks('git worktree remove ../wt') && !blocks('git worktree prune'));
  ok('git log / status are allowed', !blocks('git log --oneline -3') && !blocks('git status'));
  ok('a non-git command no-ops', !blocks('echo switch checkout worktree add'));
  ok('git quoted inside another command no-ops', !blocks(`node -e "run('git worktree add ../x')"`) && !blocks("echo 'git switch -c x'"));
  ok('an env-prefixed git invocation still blocks', blocks('GIT_TRACE=1 git worktree add ../wt4'));

  ok('clone INTO a project blocks', blocks('git clone https://example.com/lib.git vendor/lib'));
  ok('clone OF a project (local path) blocks', blocks(`git clone "${bg}" proj-d2`, parent));
  ok('clone of a project remote BESIDE it blocks (scp spelling)', blocks('git clone git@github.com:CSparks/proj.git proj-d2', parent));
  ok('clone of a project remote beside it blocks (https spelling, default dest)', blocks('git clone https://github.com/CSparks/proj proj-copy', parent));
  ok('negative control: an unrelated clone beside the project is allowed', !blocks('git clone https://github.com/CSparks/other.git', parent));

  ok('[maintainer-asked-branch: <words>] escapes', !blocks('git worktree add ../wt [maintainer-asked-branch: "spin up a worktree for the demo"]'));
  ok('an empty [maintainer-asked-branch:] does not escape', blocks('git worktree add ../wt [maintainer-asked-branch: ]'));
  ok('the retired [allow-branch:] token no longer escapes', blocks('git switch feature-x [allow-branch: deliberate]'));
  ok('the retired CLAUDE_KIT_ALLOW_BRANCH=1 env no longer escapes',
    hook('branch-guard.mjs', { tool_input: { command: 'git switch feature-x' } }, bg, { CLAUDE_KIT_ALLOW_BRANCH: '1' }).code === 2);

  const plain = identify(repo());
  ok('non-adopted repo no-ops (worktree add)', !blocks('git worktree add ../wt', plain));
  ok('non-adopted repo no-ops (switch)', !blocks('git switch -c x', plain));
} finally {
  cleanup();
}

done();
