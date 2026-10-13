#!/usr/bin/env node
// PostToolUse (Bash|PowerShell) — after a `git commit`, stamp each ticket the subject says it
// implements with a `(landed) <sha> <subject>` History line (KIT-T444), so a ticket whose
// commits are in git never reads as unbuilt. Idempotent per sha, append-only, any store the
// registry resolves. A cited id with no ticket warns on stderr; every error fails open (exit 0).

import { readFileSync, writeFileSync } from 'node:fs';
import { payload, git, gitRoot, adopted } from './lib.mjs';

const COMMIT_CMD = /\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+commit\b/;
const FIELD_SEP = '\u0001';

try {
  const p = await payload();
  const cmd = (p && p.tool_input && p.tool_input.command) || '';
  if (!COMMIT_CMD.test(cmd) || /--dry-run/.test(cmd)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const [sha, subject] = git(['log', '-1', `--format=%h${FIELD_SEP}%s`], root).trim().split(FIELD_SEP);
  const { implementedIds, stampLanded } = await import('../scripts/landed.mjs');
  const { findItemFile } = await import('../scripts/q-show.mjs');
  for (const id of implementedIds(subject || '')) {
    const file = findItemFile(id, root);
    if (!file) { process.stderr.write(`[commit-stamp] ${id}: no ticket file found, not stamped\n`); continue; }
    const next = stampLanded(readFileSync(file, 'utf8'), sha, subject);
    if (next === null) continue;
    writeFileSync(file, next);
    process.stderr.write(`[commit-stamp] ${id}: landed ${sha}\n`);
  }
} catch {
  /* fail-open — a stamp error must never block the tool call */
}
process.exit(0);
