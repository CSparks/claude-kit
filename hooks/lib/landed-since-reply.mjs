// landed-since-reply.mjs — the commits a coordinator has to name in its next reply, put in front of it when a hand-back,
// task notification or message arrives (KIT-T1379): the Stop landing alert refused four replies in a row for a sha the
// coordinator never saw.
//
//   pendingLandings({ root, turnStartMs, transcript }) -> [{ repo, sha, shortSha, subject }] newest first: per repo (the
//        project and each checked-out submodule), the commits landed this turn (landed-commits.mjs) and those not pushed,
//        minus the ones an earlier assistant reply already named by sha
//   noticeLines(pending, alreadyListed)                -> lines of the LANDED SINCE LAST REPLY block for the commits not
//        listed before; [] when none. At most MAX_LISTED commits are named, the rest collapse to a count.

import { basename } from 'node:path';
import { git } from './exec.mjs';
import { landedThisTurn, submodulesOf } from './landed-commits.mjs';
import { unannouncedIn } from './announced-landings.mjs';

export const MAX_LISTED = 8;
const SUBJECT_CHARS = 80;
const SHORT_SHA = 8;
const UNPUSHED_DEPTH = 20;
const FIELD_SEP = '\x1f';

function unpushed(repo) {
  if (!git(['-C', repo, 'remote']).trim()) return [];
  return git(['-C', repo, 'log', `--pretty=%H${FIELD_SEP}%s`, '-n', String(UNPUSHED_DEPTH), 'HEAD', '--not', '--remotes'])
    .split('\n').filter(Boolean).map((line) => { const [sha, subject = ''] = line.split(FIELD_SEP); return { sha, subject }; });
}

export function pendingLandings({ root, turnStartMs = 0, transcript = '' }) {
  const out = [];
  const seen = new Set();
  for (const repo of [root, ...submodulesOf(root)]) {
    const landed = turnStartMs ? landedThisTurn(repo, turnStartMs) : [];
    const commits = [...landed, ...unpushed(repo)].filter((c) => c.sha && !seen.has(c.sha) && seen.add(c.sha));
    const open = transcript ? unannouncedIn(transcript, commits) : commits;
    for (const c of open) out.push({ repo: basename(repo), sha: c.sha, shortSha: c.sha.slice(0, SHORT_SHA), subject: String(c.subject || '').slice(0, SUBJECT_CHARS) });
  }
  return out;
}

export function noticeLines(pending, alreadyListed = []) {
  const listed = new Set(alreadyListed);
  const fresh = pending.filter((c) => !listed.has(c.sha));
  if (!fresh.length) return [];
  const shown = fresh.slice(0, MAX_LISTED).map((c) => `  ${c.repo} ${c.shortSha} ${c.subject}`);
  const more = fresh.length > MAX_LISTED ? [`  +${fresh.length - MAX_LISTED} more (t receipt lists them)`] : [];
  return ['LANDED SINCE LAST REPLY: name each sha in your reply (the Stop landing alert asks for them; 7 hex characters suffice):', ...shown, ...more];
}
