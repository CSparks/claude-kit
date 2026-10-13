// t/ticket-file.mjs — locating a ticket file and writing its frontmatter scalars; shared by the
// t subcommands (t.mjs) and the status transition (t/status.mjs).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { splitFrontmatter, field } from '../frontmatter.mjs';

export const SHA_RE = /^[0-9a-f]{7,40}$/i; // a git short/long sha


// Set a scalar in place, preserving the existing (possibly empty) line; append the key at the
// end of the block when absent. Mirrors reconcile-supersede.setField so an edge written here
// reads back identically to one the reconcile pass writes.
export function setField(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `$1 ${value}`);
  return `${fm}\n${key}: ${value}`;
}

// --- ticket lookup -------------------------------------------------------------------------

function ticketDirs(root) {
  const base = join(root, '.ai', 'tickets');
  return [base, join(base, 'archive')];
}

// Resolve an id to its on-disk file (active dir or archive). Throws loudly on an unknown id —
// no subcommand ever invents or guesses one.
export function findTicket(root, id) {
  for (const dir of ticketDirs(root)) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f === '_TEMPLATE.md' || f === 'INDEX.md') continue;
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const parts = splitFrontmatter(text);
      const fid = (parts && field(parts.fm, 'id')) || (f.match(/[A-Za-z][A-Za-z0-9]*-[A-Za-z]?\d+/) || [])[0];
      if (fid === id) return { id, path, dir, file: f, text, parts, archived: dir.endsWith('archive') };
    }
  }
  throw new Error(`unknown id '${id}' — no ticket file carries it (ids are minted by t new, never guessed)`);
}
