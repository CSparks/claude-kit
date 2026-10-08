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

import { resolve } from 'node:path';
import { payload, git, gitRoot, pathExcluded, markerExcludedLines, excludeFooter } from './lib.mjs';
import { foreignSubmissions, policyToken, slugOf, CLAUDE_TRAILER, POLICY_URLS } from './lib/upstream-policy.mjs';

const CHECK_ID = 'upstream-policy';

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

try {
  const p = await payload();
  const command = (p.tool_input && p.tool_input.command) || '';
  if (!/\b(?:gh|git)(?:\.exe)?\b/.test(command) || !/\b(?:create|comment|push)\b/.test(command)) process.exit(0);
  const marks = markerExcludedLines(command, CHECK_ID);
  if (marks.wholeFile || marks.lines.size) process.exit(0);

  const token = policyToken(command);
  for (const sub of foreignSubmissions(command, process.cwd(), ctx)) {
    if (pathExcluded(gitRoot(sub.dir), CHECK_ID, sub.slug)) continue;
    if (!token) { process.stderr.write(NO_TOKEN(sub) + excludeFooter(CHECK_ID)); process.exit(2); }
    if (token.aiAllowed) continue;
    const hits = pendingCommits(sub).filter((c) => CLAUDE_TRAILER.test(c.body)).map((c) => `commit ${c.head}`);
    if (CLAUDE_TRAILER.test(command.replace(/\[upstream-policy-read:[^\]]*\]/i, ''))) hits.push('the command text carries Claude attribution');
    if (hits.length) { process.stderr.write(AI_FOUND(sub, hits) + excludeFooter(CHECK_ID)); process.exit(2); }
    process.stderr.write(`upstream-policy: ${sub.kind} to ${sub.slug} is ai-allowed: no. The title, body and comments must be the maintainer's own words.\n`);
  }
  process.exit(0);
} catch {
  process.exit(0);
}
