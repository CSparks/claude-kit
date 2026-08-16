#!/usr/bin/env node
// end-task.mjs — programmatic close for an agent (KIT-T029).
//
// The GOAL: an agent calls this instead of hand-editing frontmatter. Delegates ALL
// status + history mutations to t.mjs (the canonical store mutation tool, KIT-T075),
// so this is a thin wrapper — no duplicate validation, no re-implemented stamp logic.
//
//   node scripts/end-task.mjs <id> <status> [--note "..."] [--root <dir>]
//                             [--fixed-commit <sha>] [--human]
//
// <status> is any state t.mjs knows (todo|doing|review|done|superseded …).
// --note appends a timestamped comment line under ## History (via t.mjs --note,
//   which follows the KIT-D037 convention: Notes=prose, History=events).
// Fail-open: exits non-zero on a hard failure, never silently swallows one.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const T_SCRIPT = resolve(SCRIPT_DIR, 't.mjs');

function parseArgs(argv) {
  const flags = { note: null, root: null, fixedCommit: null, human: false };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--note') { flags.note = argv[++i]; }
    else if (a === '--root') { flags.root = argv[++i]; }
    else if (a === '--fixed-commit') { flags.fixedCommit = argv[++i]; }
    else if (a === '--human') { flags.human = true; }
    else pos.push(a);
  }
  return { flags, pos };
}

async function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  const [id, status] = pos;

  if (!id || !status) {
    process.stderr.write('usage: end-task.mjs <id> <status> [--note "..."] [--root <dir>] [--fixed-commit <sha>] [--human]\n');
    process.exit(2);
  }

  // Delegate to t.mjs — it validates status, stamps History, archives on done, and
  // refreshes the board + cache in one invocation. Never duplicate its logic here.
  const args = ['node', T_SCRIPT, 'status', id, status];
  if (flags.root) args.push('--root', flags.root);
  if (flags.note) args.push('--note', flags.note);
  // The fixing sha is written on ANY call, transition or not (KIT-T157/KIT-T190): a
  // review→review close is the shape an agent reaches for, and without the pass-through
  // fixed_commit stayed blank with no warning.
  if (flags.fixedCommit) args.push('--fixed-commit', flags.fixedCommit);
  if (flags.human) args.push('--human');

  // t.mjs emits "status: <id> <from> → <to>" to stdout and warnings to stderr.
  // Pass both through directly so the calling orchestrator sees them.
  try {
    execFileSync(args[0], args.slice(1), { stdio: 'inherit' });
  } catch (e) {
    // execFileSync throws when the child exits non-zero. The child already wrote its
    // error to stderr — re-emit a one-liner so the caller has a clear entry point.
    const code = e.status ?? 1;
    process.stderr.write(`end-task: t status ${id} ${status} failed (exit ${code})\n`);
    process.exit(code);
  }
}

main().catch((e) => {
  process.stderr.write('end-task: ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
});
