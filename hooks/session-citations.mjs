// Path-shaped citations in .ai/SESSION.md — the durable anchor must not point at files that
// don't exist (KIT-T215). A delegated agent that writes its deliverable to a cwd-relative /
// session-temp path leaves a citation that dies with the session; this resolves every cited
// path and reports the ones absent from disk.
//
//   citedPaths(text)            -> the repo-checkable path tokens (separator + extension; host/home paths excluded)
//   missingCitations(root, text)-> those that don't resolve on disk, relative paths anchored at root;
//                                  absolute paths outside root (another project's tree) are skipped

import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// A citation is a token carrying at least one path separator and a trailing file extension:
// `docs/research/x.md`, `D:\dev\p\notes.md`, `../out/report.json`. Bare `SESSION.md` (no
// separator) is deliberately NOT a citation — prose is full of dotted words.
const EXTENSION_MAX_LEN = 6;
// The trailing lookahead rejects a longer extension (`.secrets`) instead of truncating it.
const CITATION_RE = new RegExp(
  `(?:[A-Za-z]:[\\/]|[~.\\w@-]*[\\/])[^\\s\`'"()[\\]<>,;]*\\.[A-Za-z0-9]{1,${EXTENSION_MAX_LEN}}(?![A-Za-z0-9])`,
  'g',
);
// URL-ish and glob-ish tokens are never on-disk citations.
const NOT_A_PATH = /^\w+:\/\/|[*?]/;
// POSIX-absolute and home-relative paths name another host or the user's machine, never a repo
// artifact: `/srv/app/.env`, `~/.ssh/config`.
const HOST_OR_HOME_PATH = /^[\/~]/;

export function citedPaths(text) {
  const out = new Set();
  const scrubbed = String(text || '').replace(/\w+:\/\/\S+/g, ' '); // URLs are not on-disk paths
  for (const m of scrubbed.matchAll(CITATION_RE)) {
    const raw = m[0].replace(/[.,;:)]+$/, '');
    if (!raw || NOT_A_PATH.test(raw) || HOST_OR_HOME_PATH.test(raw)) continue;
    if (!/[\/]/.test(raw)) continue;
    out.add(raw);
  }
  return [...out];
}

// An absolute path outside `root` names another project's tree; this repo's anchor cannot fix it.
function outsideRoot(root, p) {
  if (!isAbsolute(p)) return false;
  const rel = relative(resolve(root), resolve(p));
  return rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
}

// A line that calls a path stale, renamed or gone declares it history: the anchor already says so, and
// `t session` only appends, so the warning must accept that sentence as the answer.
const STALE_MARK = /\b(?:stale|no longer exists?|renam\w*|removed|deleted|moved|gone|historical|superseded|not re-anchored)\b/i;
const BARE_FILE = /[\w-]+\.[A-Za-z0-9]{1,6}(?![\w])/g;
const DATED_ENTRY = /^- \[\d{4}-\d{2}-\d{2}/;
// Dated entries past the newest few are session history, not live anchors.
const LIVE_DATED_ENTRIES = 10;

function declaredStale(lines) {
  const marked = lines.filter((l) => STALE_MARK.test(l)).join('\n');
  return [...citedPaths(marked), ...(marked.match(BARE_FILE) || [])];
}

function liveText(lines) {
  let dated = 0;
  let history = false;
  return lines.filter((l) => {
    if (DATED_ENTRY.test(l)) history = ++dated > LIVE_DATED_ENTRIES;
    else if (!/^\s/.test(l) && l.trim()) history = false;
    return !history;
  }).join('\n');
}

const isDeclared = (p, declared) => declared.some((d) => p === d || p.endsWith(`/${d}`));

export function missingCitations(root, text) {
  const lines = String(text || '').split('\n');
  const declared = declaredStale(lines);
  return citedPaths(liveText(lines))
    .filter((p) => !isDeclared(p, declared) && !outsideRoot(root, p) && !existsSync(isAbsolute(p) ? p : resolve(root, p)));
}
