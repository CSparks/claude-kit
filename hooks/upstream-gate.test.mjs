// upstream-gate (KIT-T395): gh pr/issue create|comment and git push aimed at a repo the
// account of record does not own block until the command declares the target's policy was read;
// ai-allowed: no also rejects Claude trailers in the pending commits. Wiring asserted from hooks.json.
// Run: node hooks/upstream-gate.test.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ENV, HOOKS, cleanup, git, hook, identify, reporter, repo, tmpDir } from './test-harness.mjs';
import { hiddenBehindQuotes } from './hidden-command-cases.mjs';

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
  ok('KIT-T705 negative control: node -e with escaped quotes and no gh or git word passes', !blocks('node -e "console.log(\\"x\\")"'));
  ok('KIT-T705: a foreign submission hidden behind an escaped quote or a $\'…\' string blocks', hiddenBehindQuotes('gh pr create --repo bevyengine/bevy --title t').every((c) => blocks(c)));
  const bash = (command) => hook('upstream-gate.mjs', { tool_name: 'Bash', tool_input: { command } }, fork).code === 2;
  const prose = 't notes KIT-T1 "baseline: use \\"git stash push -m x -- f\\" then pop"';
  ok('KIT-T1564: a Bash store-verb note naming git commands inside escaped quotes is not a submission', !bash(prose));
  ok('KIT-T1564: the same note under PowerShell, where a backslash does not escape, stays refused as ambiguous',
    hook('upstream-gate.mjs', { tool_name: 'PowerShell', tool_input: { command: prose } }, fork).code === 2);
  ok('KIT-T1564: a real foreign push chained after such a note still blocks under Bash', bash(`${prose} && gh pr create --repo bevyengine/bevy --title t`));
  ok('KIT-T1564: a foreign submission hidden behind an escaped quote still blocks under Bash', hiddenBehindQuotes('gh pr create --repo bevyengine/bevy --title t').every((c) => bash(c)));
  const ownGh = 'gh pr create --repo CSparks/bevy --title ';
  ok('control: an own-repo submission with plain quotes passes under Bash', !bash(`${ownGh}"t"`));
  ok('KIT-T1564 review: a nested bash -c string holding an escaped quote keeps the blanket block', bash(`bash -c "${ownGh}\\"t\\""`) && bash(`sh -c '${ownGh}\\"t\\"'`));
  ok('KIT-T1564 review: eval, ssh and su -c strings holding an escaped quote keep the blanket block',
    bash(`eval "${ownGh}\\"t\\""`) && bash(`ssh host "${ownGh}\\"t\\""`) && bash(`su -c "${ownGh}\\"t\\"" root`));
  ok('KIT-T1564 review: a segment other than a kit verb holding an escaped quote keeps the blanket block', bash(`echo \\"x\\" && ${ownGh}"t"`));
  ok('KIT-T1564 review: a kit verb whose argument holds a command substitution with an escaped quote keeps the blanket block',
    bash('t notes KIT-T1 "$(gh pr create --repo bevyengine/bevy --title \\"x\\")"') && bash(`t notes KIT-T1 "\`${ownGh}\\"x\\"\`"`));
  ok('KIT-T1564 review: nested foreign submissions without an escaped quote block under Bash', bash('bash -c "gh pr create --repo bevyengine/bevy --title t"') && bash('eval "gh pr create --repo bevyengine/bevy --title t"'));
  ok('KIT-T1564 review: the last -R names the target, as gh reads repeated flags', bash('gh pr create -R CSparks/bevy -R bevyengine/bevy --title t') && !bash('gh pr create -R bevyengine/bevy -R CSparks/bevy --title t') && bash('gh pr create --repo=CSparks/bevy --repo bevyengine/bevy --title t'));
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

  const spacedFork = join(tmpDir('kit spaced fork-'), 'my fork').replace(/\\/g, '/');
  mkdirSync(spacedFork);
  git(['init', '-q'], spacedFork);
  git(['remote', 'add', 'upstream', 'https://github.com/bevyengine/bevy.git'], spacedFork);
  const elsewhere = tmpDir('kit elsewhere-');
  ok('KIT-T1174: git -C "<dir with a space>" push blocks', blocks(`git -C "${spacedFork}" push upstream main`, elsewhere));
  ok('KIT-T1174: git -c k=v -C "<dir with a space>" push blocks', blocks(`git -c core.pager=cat -C '${spacedFork}' push upstream main`, elsewhere));
  ok('KIT-T1174: git --no-pager and -P before push block', blocks('git --no-pager push upstream main') && blocks('git -P push upstream main'));
  ok('KIT-T1174: a push inside bash -c blocks', blocks(`bash -c 'git push upstream main'`) && blocks(`bash -c "git -C '${spacedFork}' push upstream main"`, elsewhere));
  ok('KIT-T1174 control: git -C "<dir with a space>" log and git --no-pager log pass', !blocks(`git -C "${spacedFork}" log`, elsewhere) && !blocks('git --no-pager log'));
  ok('KIT-T1174 control: the words git push inside another command pass', !blocks('echo "git push upstream main"') && !blocks(`bash -c 'echo git push upstream main'`));

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
