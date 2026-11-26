#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — upstream contributions to repos the account of record does
// not own (KIT-T395). exit 2 = block, 0 = allow. Fails open on any parse or git error.
//
// Fires on:  gh pr create | gh issue create | gh pr comment | gh issue comment
//            git push to a remote owned by someone else
// Clears on: [upstream-policy-read: <url or path>; ai-allowed: yes|no] in the command.
//            With ai-allowed: no the pending commits (and the command text) must also be free
//            of Claude trailers and AI attribution.
// Runs in any repo, adopted or not: the fork checkout a contribution comes from is not one.
// Check-id: upstream-policy (path glob subject: the target's owner/repo).
// Also: a `git push` of a repo that tracks a pre-push gate git is not set to run is blocked with the command that wires
// it, and a push whose wiring cannot be checked is blocked (KIT-T1300; lib/push-hooks.mjs). Check-id: pre-push-wired
// (path glob subject: the tracked hooks directory, repo-relative).
// Also: a push whose HEAD points a submodule at a commit the submodule's remote lacks (KIT-T1363; lib/push-pins.mjs).
// Check-id: push-pin (path glob subject: the submodule path).
// Also: a push of a repo whose checked-out submodule is not at the commit HEAD records (unpushed work, an uncommitted pin) is
// blocked with the order to follow: submodule push, pin commit, this push (KIT-T1447; lib/push-drift.mjs). Check-id: push-drift
// (path glob subject: the submodule path). Main thread and subagents alike.

import { resolve } from 'node:path';
import { payload, git, gitRoot, pathExcluded, markerExcludedLines, excludeFooter } from './lib.mjs';
import { AMBIGUOUS_MESSAGE, segments, shellOfTool } from './lib/shell-segments.mjs';
import { foreignSubmissions, policyToken, pushedRepos, slugOf, CLAUDE_TRAILER, POLICY_URLS } from './lib/upstream-policy.mjs';
import { pushHookStatus, wireCommand } from './lib/push-hooks.mjs';
import { unpushedPinMessage, unpushedPins } from './lib/push-pins.mjs';
import { driftMessage, submoduleDrift } from './lib/push-drift.mjs';

const CHECK_ID = 'upstream-policy';
const WIRING_CHECK_ID = 'pre-push-wired';
const PIN_CHECK_ID = 'push-pin';
const DRIFT_CHECK_ID = 'push-drift';

const ctx = {
  resolveDir: (from, to) => resolve(from, to),
  remotes: (dir) => {
    const seen = new Map();
    for (const l of git(['remote', '-v'], dir).split('\n')) {
      const [name, url] = l.split(/\s+/);
      if (name && url && !seen.has(name)) seen.set(name, { name, url });
    }
    return [...seen.values()];
  },
  defaultRemote: (dir) => {
    const branch = git(['branch', '--show-current'], dir).trim();
    const cfg = (k) => git(['config', '--get', k], dir).trim();
    return (branch && (cfg(`branch.${branch}.pushRemote`) || '')) || cfg('remote.pushDefault') || (branch && cfg(`branch.${branch}.remote`)) || '';
  },
  ghResolved: (dir) => {
    const out = git(['config', '--get-regexp', '^remote\\..*\\.gh-resolved$'], dir).split('\n')[0] || '';
    const m = out.match(/^remote\.(\S+)\.gh-resolved\s+(\S+)/);
    return m ? (m[2] === 'base' ? m[1] : m[2]) : '';
  },
};

// Commits a push or PR from `dir` would publish to the target: those on no branch of its remote.
function pendingCommits(sub) {
  const slug = sub.slug.toLowerCase();
  const remote = sub.remote || ctx.remotes(sub.dir).find((r) => slugOf(r.url).toLowerCase() === slug);
  const args = remote ? ['HEAD', '--not', `--remotes=${remote.name}`] : ['@{u}..HEAD'];
  const out = git(['log', '--format=%h %s%x01%B%x02', ...args], sub.dir);
  return out.split('\x02').map((c) => c.trim()).filter(Boolean).map((c) => {
    const [head, body = ''] = c.split('\x01');
    return { head, body };
  });
}

const policyHint = (slug) => {
  const owner = slug.split('/')[0].toLowerCase();
  const known = POLICY_URLS[owner] ? `\n  Known policy for ${owner}: ${POLICY_URLS[owner]}` : '';
  return [
    `  Read the target's contribution rules and AI policy before anything is submitted to ${slug}:`,
    '    CONTRIBUTING.md, .github/CONTRIBUTING.md, docs/CONTRIBUTING.md, docs/AI*, docs/policies/,',
    `    CODE_OF_CONDUCT.md, the project site's contribute/policies pages.${known}`,
  ].join('\n');
};

const TOKEN_HELP = [
  'Then state it in the command (a trailing shell comment works):',
  '  [upstream-policy-read: <url or path of the policy you read>; ai-allowed: yes|no]',
].join('\n');

const NO_TOKEN = (sub) => [
  '',
  `BLOCKED: ${sub.kind} to ${sub.slug}, a repo outside the account of record (KIT-T395).`,
  '',
  policyHint(sub.slug),
  '',
  'Where the policy bans AI authorship or AI-written prose (Bevy does: bevyengine/bevy#26045',
  'was closed on 2026-10-07 for a Claude Co-Authored-By trailer and AI-written PR text), the',
  'submission is the maintainer\'s own: the commit authored by him with no Claude trailer, the',
  'prose in his words. Claude explains the code to him; Claude does not write the submission.',
  '',
  TOKEN_HELP,
  '',
].join('\n');

const AI_FOUND = (sub, hits) => [
  '',
  `BLOCKED: ${sub.kind} to ${sub.slug} declares ai-allowed: no, but AI attribution is present (KIT-T395).`,
  ...hits.map((h) => `  ${h}`),
  '',
  'Hand the submission to the maintainer: the commits re-authored by him without the Claude',
  'trailer, the title and body in his own words.',
  '',
].join('\n');

const wiringBlock = (lines) => {
  process.stderr.write(`\nBLOCKED: ${lines.join('\n')}\n${excludeFooter(WIRING_CHECK_ID)}`);
  process.exit(2);
};

// A `git push` whose repo tracks a pre-push gate that git is not set to run is blocked with the command that wires it; a git
// call that fails is blocked too (KIT-T1300). A repo with no tracked pre-push is untouched.
function checkPushHooks(command, shell) {
  let repos;
  try {
    repos = pushedRepos(command, process.cwd(), ctx, { shell });
  } catch (e) {
    if (/\bgit(?:\.exe)?\b[^\n]*\bpush\b/.test(command)) wiringBlock([`the repo of this git push could not be found, so its pre-push wiring was not checked (${e.message}).`]);
    return;
  }
  for (const { dir } of repos) {
    let verdict;
    let wire = '';
    try {
      verdict = pushHookStatus(dir);
      if (verdict.status === 'unwired') wire = wireCommand(verdict.top, verdict.hookDir);
    } catch (e) {
      wiringBlock([`the pre-push wiring of ${dir} could not be checked, and a check that cannot complete refuses (KIT-T1300): ${e.message}`]);
    }
    if (verdict.status !== 'unwired' || pathExcluded(verdict.top, WIRING_CHECK_ID, verdict.hookDir)) continue;
    wiringBlock([
      `this git push would run no pre-push gate (KIT-T1300): ${verdict.top.replace(/\\/g, '/')} tracks ${verdict.hookDir}/pre-push, but core.hooksPath does not point at it and`,
      'the git dir has no pre-push hook, so git skips the gate. Wire it once, then push:',
      `  ${wire}`,
    ]);
  }
}

// A `git push` of a superproject whose HEAD points a submodule at a commit the submodule's remote lacks is blocked, naming
// the submodule push to do first (KIT-T1363). A repo with no submodule is untouched; a git error never blocks.
function checkPushPins(command, shell) {
  let repos = [];
  try { repos = pushedRepos(command, process.cwd(), ctx, { shell }); } catch { return; }
  for (const { dir } of repos) {
    const top = gitRoot(dir);
    const pins = top ? unpushedPins(top).filter((pin) => !pathExcluded(top, PIN_CHECK_ID, pin.path)) : [];
    if (!pins.length) continue;
    process.stderr.write(unpushedPinMessage(top, pins, excludeFooter(PIN_CHECK_ID)));
    process.exit(2);
  }
}

// A `git push` of a superproject whose submodule checkout is not at the commit HEAD records is blocked, naming the steps in
// order (KIT-T1447). A repo with no submodule drift is untouched; any error never blocks.
function checkPushDrift(command, shell) {
  try {
    const marks = markerExcludedLines(command, DRIFT_CHECK_ID);
    if (marks.wholeFile || marks.lines.size) return;
    for (const { dir } of pushedRepos(command, process.cwd(), ctx, { shell })) {
      const top = gitRoot(dir);
      const drifts = top ? submoduleDrift(top).filter((d) => !pathExcluded(top, DRIFT_CHECK_ID, d.path)) : [];
      if (!drifts.length) continue;
      process.stderr.write(driftMessage(top, drifts, excludeFooter(DRIFT_CHECK_ID)));
      process.exit(2);
    }
  } catch { /* fail open */ }
}

try {
  const p = await payload();
  const command = (p.tool_input && p.tool_input.command) || '';
  if (!/\b(?:gh|git)(?:\.exe)?\b/.test(command) || !/\b(?:create|comment|push)\b/.test(command)) process.exit(0);
  const marks = markerExcludedLines(command, CHECK_ID);
  const upstreamMarked = marks.wholeFile || marks.lines.size;

  if (segments(command).ambiguous && !upstreamMarked) {
    process.stderr.write(`\nBLOCKED: a gh or git submission cannot be matched to its target repo (KIT-T395). ${AMBIGUOUS_MESSAGE}\n${excludeFooter(CHECK_ID)}`);
    process.exit(2);
  }

  const token = policyToken(command);
  const shell = shellOfTool(p.tool_name);
  for (const sub of upstreamMarked ? [] : foreignSubmissions(command, process.cwd(), ctx, { shell })) {
    if (pathExcluded(gitRoot(sub.dir), CHECK_ID, sub.slug)) continue;
    if (!token) { process.stderr.write(NO_TOKEN(sub) + excludeFooter(CHECK_ID)); process.exit(2); }
    if (token.aiAllowed) continue;
    const hits = pendingCommits(sub).filter((c) => CLAUDE_TRAILER.test(c.body)).map((c) => `commit ${c.head}`);
    if (CLAUDE_TRAILER.test(command.replace(/\[upstream-policy-read:[^\]]*\]/i, ''))) hits.push('the command text carries Claude attribution');
    if (hits.length) { process.stderr.write(AI_FOUND(sub, hits) + excludeFooter(CHECK_ID)); process.exit(2); }
    process.stderr.write(`upstream-policy: ${sub.kind} to ${sub.slug} is ai-allowed: no. The title, body and comments must be the maintainer's own words.\n`);
  }
  checkPushHooks(command, shell);
  checkPushPins(command, shell);
  checkPushDrift(command, shell);
  process.exit(0);
} catch {
  process.exit(0);
}
