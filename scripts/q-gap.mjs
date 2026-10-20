// q-gap.mjs — q capability misses become kit-bug tickets (KIT-T286): an unknown query verb or a
// flag the verb does not take is a gap in q, not a reason to fall back to grep. The caller gets
// the ticket id to print.

import { fileKitBug } from './kit-bug.mjs';
import { SCOPED_VERBS } from './q-scope-flag.mjs';

const GLOBAL_FLAGS = new Set(['--json', '--no-db', '--root', '--topic', '--help']);
const VERB_FLAGS = {
  fts: ['--scope', '--project', '--limit', '--any'], inbox: ['--older-than'], confirmations: ['--older-than'], similar: ['--store', '--scopes'],
  sessions: ['--project'], recent: [], open: ['--status'], trail: [], orphans: [], rundown: [], governing: [], drift: [], mentions: [],
  children: [], backlinks: [], 'by-commit': [], 'doc-trail': [], topics: [], topic: [], 'next-id': [], regressions: [],
  supersedes: [], integrity: [], verify: [], session: [], said: [], show: [], sql: [],
};

/** Flags on `args` that `cmd` does not take ([] for verbs that parse their own flags). */
export function unsupportedFlags(cmd, args) {
  const base = VERB_FLAGS[cmd];
  if (!base) return [];
  const known = SCOPED_VERBS.has(cmd) ? [...base, '--scope', '--project'] : base;
  return args.filter((a) => /^--[a-z][a-z-]*$/.test(String(a)) && !GLOBAL_FLAGS.has(a) && !known.includes(a));
}

/** File (or recur) the gap; returns { id } or null. */
export function reportGap({ shape, title, detail, project }) {
  return fileKitBug({ shape: `q-gap:${shape}`, title: `q gap: ${title}`, detail, project });
}
