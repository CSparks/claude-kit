// `t receipt [--since <sha|duration>]` — the landing receipt skeleton (KIT-T1144).
// Prints, for the repo of the cwd and each submodule, the real-work commits landed since a boundary:
// short sha, the ticket ids it cites, and its push state, then ONE line to fill — a UAT step or
// `[no-test: <reason>]`. Nothing landed prints one line. Writes nothing.
//
// Boundary, in order:
//   --since <sha>       commits after that commit (its time bounds the submodules too)
//   --since <duration>  the last 30s / 15m / 2h / 1d, by any author
//   (default) the landing-alert gate's last listing, when it recorded one inside the default window:
//             its turn start, so the receipt matches what the gate listed this turn
//   (default) else the last 60 minutes by this repo's git user.email
//
//   buildReceipt(cwd, { since }, nowMs) -> { text }     runReceipt({ since }) prints it

import { basename, relative } from 'node:path';
import { git } from '../hooks/lib/exec.mjs';
import { gitRoot } from '../hooks/lib/paths.mjs';
import { readTurnState } from '../hooks/lib/turn-state.mjs';
import { LAND_SLOT, TURN_SKEW_MS, commitState, landedSince, submodulesOf } from '../hooks/lib/landed-commits.mjs';

const MS_PER_SEC = 1000;
const MS_PER_MIN = 60 * MS_PER_SEC;
const DEFAULT_WINDOW_MS = 60 * MS_PER_MIN;
const UNIT_MS = { s: MS_PER_SEC, m: MS_PER_MIN, h: 60 * MS_PER_MIN, d: 24 * 60 * MS_PER_MIN };
const SUBJECT_MAX = 100;
const FILL_LINE = 'UAT / no-test (fill one): <what the maintainer can try as a user, or [no-test: <reason>]>';

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const clock = (ms) => new Date(ms).toISOString().slice(11, 16);

function parseDuration(text) {
  const m = String(text).match(/^(\d+)([smhd])$/i);
  return m ? Number(m[1]) * UNIT_MS[m[2].toLowerCase()] : null;
}

// -> { sinceMs, skewMs, author, excludeSha, label, error }
function resolveBoundary(root, since, nowMs) {
  if (since) {
    const sha = git(['-C', root, 'rev-parse', '--verify', '--quiet', `${since}^{commit}`]).trim();
    if (sha) {
      const ct = Number(git(['-C', root, 'show', '-s', '--format=%ct', sha]).trim());
      return { sinceMs: ct * MS_PER_SEC, excludeSha: sha, label: `since commit ${sha.slice(0, 7)} (--since)` };
    }
    const ms = parseDuration(since);
    if (ms !== null) return { sinceMs: nowMs - ms, label: `in the last ${since} by any author (--since)` };
    return { error: `--since ${since} is neither a commit in this repo nor a duration like 30m, 2h, 1d` };
  }
  const recorded = readTurnState(root, LAND_SLOT);
  if (recorded?.listed?.length && Number.isFinite(recorded.turnStartMs) && nowMs - recorded.at <= DEFAULT_WINDOW_MS) {
    return { sinceMs: recorded.turnStartMs, skewMs: TURN_SKEW_MS, label: `since the landing-alert's last listing (turn start ${clock(recorded.turnStartMs)} UTC, ${recorded.listed.length} commit(s) listed)` };
  }
  return { sinceMs: nowMs - DEFAULT_WINDOW_MS, byUser: true, label: 'in the last 60 minutes by this git user (the landing-alert gate has no listing inside that window)' };
}

function reposOf(root) {
  return [[root, basename(root)], ...submodulesOf(root).map((abs) => [abs, `submodule ${relative(root, abs).replace(/\\/g, '/')}`])];
}

function commitLine(root, c) {
  const tickets = c.ids.length ? c.ids.join(', ') : 'no ticket cited';
  return `  ${c.shortSha} ${clip(c.subject, SUBJECT_MAX)} | ${tickets} | ${commitState(root, c.sha)}`;
}

export function buildReceipt(cwd, { since } = {}, nowMs = Date.now()) {
  const root = gitRoot(cwd);
  if (!root) return { text: 't receipt: not inside a git repository', code: 2 };
  const b = resolveBoundary(root, since, nowMs);
  if (b.error) return { text: `t receipt: ${b.error}`, code: 2 };

  const sections = [];
  for (const [repo, name] of reposOf(root)) {
    const author = b.byUser ? git(['-C', repo, 'config', 'user.email']).trim() : '';
    const landed = landedSince(repo, { sinceMs: b.sinceMs, skewMs: b.skewMs, author }).filter((c) => c.sha !== b.excludeSha);
    if (landed.length) sections.push([`${name}:`, ...landed.map((c) => commitLine(repo, c))].join('\n'));
  }
  if (!sections.length) return { text: `nothing landed ${b.label}`, code: 0 };
  return { text: [`Landing receipt, ${b.label}`, ...sections, FILL_LINE].join('\n'), code: 0 };
}

export function runReceipt(flags) {
  const r = buildReceipt(process.cwd(), { since: flags.since });
  (r.code ? process.stderr : process.stdout).write(`${r.text}\n`);
  process.exitCode = r.code;
}
