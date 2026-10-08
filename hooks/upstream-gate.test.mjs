// upstream-gate (KIT-T395): gh pr/issue create|comment and git push aimed at a repo the
// account of record does not own block until the command declares the target's policy was read;
// ai-allowed: no also rejects Claude trailers in the pending commits. Wiring asserted from hooks.json.
// Run: node hooks/upstream-gate.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ENV, HOOKS, cleanup, git, hook, identify, reporter, repo } from './test-harness.mjs';

const { ok, done } = reporter('upstream-gate');
const TOKEN_YES = '[upstream-policy-read: https://bevy.org/learn/contribute/policies/ai/; ai-allowed: yes]';
const TOKEN_NO = '[upstream-policy-read: https://bevy.org/learn/contribute/policies/ai/; ai-allowed: no]';

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('upstream-gate')));
  ok('wired into hooks.json for Bash AND PowerShell', !!entry && /\bBash\b/.test(entry.matcher) && /\bPowerShell\b/.test(entry.matcher));

  const fork = identify(repo());
  writeFileSync(join(fork, 'f.txt'), 'x\n');
  git(['add', '-A'], fork);
  git(['commit', '-q', '-m', 'seed'], fork);
  const seed = git(['rev-parse', 'HEAD'], fork).trim();
  git(['remote', 'add', 'origin', 'https://github.com/CSparks/bevy.git'], fork);
  git(['remote', 'add', 'upstream', 'https://github.com/bevyengine/bevy.git'], fork);
  git(['update-ref', 'refs/remotes/upstream/main', seed], fork);
  git(['update-ref', 'refs/remotes/origin/main', seed], fork);

  const run = (command, cwd = fork) => hook('upstream-gate.mjs', { tool_input: { command } }, cwd);
  const blocks = (command, cwd) => run(command, cwd).code === 2;

  const msg = run('gh pr create --repo bevyengine/bevy --title t --body b').out;
  ok('gh pr create --repo bevyengine/bevy without the token blocks', msg.includes('BLOCKED') && msg.includes('bevyengine/bevy'));
  ok('block message names CONTRIBUTING, the Bevy policy URL, the maintainer-authors rule and the check id',
    msg.includes('CONTRIBUTING.md') && msg.includes('https://bevy.org/learn/contribute/policies/ai/')
    && /maintainer/.test(msg) && msg.includes('upstream-policy') && msg.includes('.claude-kit-ignore.yaml') && msg.includes('[upstream-policy-read:'));

  ok('gh issue create / pr comment / issue comment against a foreign repo block',
    blocks('gh issue create -R bevyengine/bevy -t t') && blocks('gh pr comment 5 --repo=bevyengine/bevy -b hi')
    && blocks('gh issue comment 5 -Rbevyengine/bevy -b hi'));
  ok('a PR URL names the target', blocks('gh pr comment https://github.com/bevyengine/bevy/pull/26045 -b hi'));
  ok('GH_REPO env prefix names the target', blocks('GH_REPO=bevyengine/bevy gh pr create --title t'));
  ok('no -R: the upstream remote of the fork is the target', blocks('gh pr create --title t --body b'));
  ok('chained segment blocks', blocks('git status && gh pr create --repo bevyengine/bevy --title t'));

  ok('token with ai-allowed: yes clears', !blocks(`gh pr create --repo bevyengine/bevy --title t  # ${TOKEN_YES}`));
  ok('token with ai-allowed: no and clean pending commits clears', !blocks(`gh pr create --repo bevyengine/bevy --title t  # ${TOKEN_NO}`));
  ok('token without a policy reference does not clear', blocks('gh pr create --repo bevyengine/bevy [upstream-policy-read: ; ai-allowed: yes]'));
  ok('token without ai-allowed does not clear', blocks('gh pr create --repo bevyengine/bevy [upstream-policy-read: CONTRIBUTING.md]'));
  ok('token with ai-allowed: maybe does not clear', blocks('gh pr create --repo bevyengine/bevy [upstream-policy-read: CONTRIBUTING.md; ai-allowed: maybe]'));

  const ai = run(`gh pr create --repo bevyengine/bevy --title t --body "Generated with Claude Code"  # ${TOKEN_NO}`);
  ok('ai-allowed: no blocks AI attribution in the command text', ai.code === 2 && ai.out.includes('ai-allowed: no'));
  ok('ai-allowed: yes tolerates AI attribution in the command text', !blocks(`gh pr create --repo bevyengine/bevy --body "Generated with Claude Code"  # ${TOKEN_YES}`));

  writeFileSync(join(fork, 'g.txt'), 'y\n');
  git(['add', '-A'], fork);
  git(['commit', '-q', '-m', 'fix a thing\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'], fork);
  const trailer = run(`gh pr create --repo bevyengine/bevy --title t  # ${TOKEN_NO}`);
  ok('ai-allowed: no blocks when a pending commit carries a Claude trailer', trailer.code === 2 && /commit [0-9a-f]+ fix a thing/.test(trailer.out));
  ok('ai-allowed: yes ignores the trailer', !blocks(`gh pr create --repo bevyengine/bevy --title t  # ${TOKEN_YES}`));
  ok('git push upstream with ai-allowed: no and a trailered commit blocks', blocks(`git push upstream main  # ${TOKEN_NO}`));
  ok('a trailer already on the target remote is not pending', (() => {
    git(['update-ref', 'refs/remotes/upstream/main', git(['rev-parse', 'HEAD'], fork).trim()], fork);
    return !blocks(`gh pr create --repo bevyengine/bevy --title t  # ${TOKEN_NO}`);
  })());

  ok('git push to a foreign remote blocks', blocks('git push upstream main'));
  ok('git push -u with option values still finds the remote', blocks('git push -o ci.skip -u upstream main'));
  ok('git push to a foreign URL blocks', blocks('git push https://github.com/bevyengine/bevy.git HEAD:main'));
  ok('git -C <dir> push blocks', blocks(`git -C "${fork.replace(/\\/g, '/')}" push upstream main`, join(fork, '..')));
  ok('git push with the token clears', !blocks(`git push upstream main  # ${TOKEN_YES}`));

  ok('negative control: gh pr create --repo CSparks/x passes', !blocks('gh pr create --repo CSparks/other --title t'));
  ok('negative control: owner match is case-insensitive', !blocks('gh pr create --repo csparks/other --title t'));
  ok('negative control: git push origin passes', !blocks('git push origin main'));
  ok('negative control: bare git push (default origin) passes', !blocks('git push'));
  ok('negative control: gh pr view / git status / git commit pass',
    !blocks('gh pr view 5 --repo bevyengine/bevy') && !blocks('git status') && !blocks('git commit -m "gh pr create --repo bevyengine/bevy"'));
  ok('quoted gh text inside another command no-ops', !blocks('echo "gh pr create --repo bevyengine/bevy"'));

  const own = identify(repo());
  git(['remote', 'add', 'origin', 'git@github.com:CSparks/mine.git'], own);
  ok('negative control: an owned repo with no -R passes', !blocks('gh pr create --title t', own) && !blocks('git push origin main', own));
  const bare = identify(repo());
  ok('a repo with no remote and no -R fails open', !blocks('gh pr create --title t', bare));

  writeFileSync(join(fork, '.claude-kit-ignore.yaml'), 'upstream-policy:\n  - bevyengine/bevy\n');
  ok('.claude-kit-ignore.yaml glob on owner/repo excludes', !blocks('gh pr create --repo bevyengine/bevy --title t'));
  ok('the exclusion is per target', blocks('gh pr create --repo someoneelse/lib --title t'));
  writeFileSync(join(fork, '.claude-kit-ignore.yaml'), '');
  ok('in-source marker excludes', !blocks('gh pr create --repo bevyengine/bevy --title t  # claude-kit-ignore upstream-policy'));

  const bad = spawnSync(process.execPath, [join(HOOKS, 'upstream-gate.mjs')], { input: '{not json', cwd: fork, encoding: 'utf8', env: ENV });
  ok('malformed stdin fails open', bad.status === 0);
} finally {
  cleanup();
}

done();
