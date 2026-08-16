// Path-shaped citations in .ai/SESSION.md — the durable anchor must not point at files that
// don't exist (KIT-T215). A delegated agent that writes its deliverable to a cwd-relative /
// session-temp path leaves a citation that dies with the session; this resolves every cited
// path and reports the ones absent from disk.
//
//   citedPaths(text)            -> the path-shaped tokens in the text (separator + extension)
//   missingCitations(root, text)-> those that don't resolve on disk, relative paths anchored at root

import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

// A citation is a token carrying at least one path separator and a trailing file extension:
// `docs/research/x.md`, `D:\dev\p\notes.md`, `../out/report.json`. Bare `SESSION.md` (no
// separator) is deliberately NOT a citation — prose is full of dotted words.
const CITATION_RE = /(?:[A-Za-z]:[\/]|[~.\w@-]*[\/])[^\s`'"()[\]<>,;]*\.[A-Za-z0-9]{1,6}/g;
// URL-ish and glob-ish tokens are never on-disk citations.
const NOT_A_PATH = /^\w+:\/\/|[*?]/;

export function citedPaths(text) {
  const out = new Set();
  const scrubbed = String(text || '').replace(/\w+:\/\/\S+/g, ' '); // URLs are not on-disk paths
  for (const m of scrubbed.matchAll(CITATION_RE)) {
    const raw = m[0].replace(/[.,;:)]+$/, '');
    if (!raw || NOT_A_PATH.test(raw)) continue;
    if (!/[\/]/.test(raw)) continue;
    out.add(raw);
  }
  return [...out];
}

export function missingCitations(root, text) {
  return citedPaths(text).filter((p) => !existsSync(isAbsolute(p) ? p : resolve(root, p)));
}
