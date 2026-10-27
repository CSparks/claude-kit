// q-help.mjs — the full query surface (printed by --help/-h/help; the query-gate points agents here)
// and one verb's entry of it (`q <verb> --help`, KIT-T338).

import { CONFIRMATION_DAYS } from './q-inbox.mjs';
import { DEFAULT_DAYS as RECENT_DAYS } from './q-recent.mjs';

const CONTINUATION = /^\s{3,}\S/;

/** The whole usage text. */
export const QUERY_SURFACE = `usage: q.mjs [--json] [--no-db] [--root <dir>] <query> [args]

  SCOPE: every [scope] argument defaults to the CWD project — a query answers about the
  repo you are standing in. Pass \`all\` (case-insensitive) for every project, or a project
  key (KIT, ST, …) for that one. Outside an adopted repo there is no key, so the default
  is every project. Applies to: open, inbox, confirmations, orphans, rundown, recent,
  regressions, supersedes, verify, and fts's --scope.

  open [scope] [--status todo|doing|review[,…]]
                              open items (todo|doing|review); --status narrows them
  inbox [scope] [--older-than Nd]
                              untriaged captures — id, age, scope, type, file path
  confirmations [scope]       captures aged past the confirmation threshold
                              (>= ${CONFIRMATION_DAYS}d — they need a human)
  children <id>               items whose parent is <id>
  backlinks <id>              items that link TO <id> (any rel) — walk DOWN
  trail <id>                  walk UP <id>'s ancestry — governing decisions/docs/origin
  orphans [scope]             open tickets/decisions with NO outbound antecedent link
  governing <path...>         OPEN tickets/decisions that GOVERN the given file path(s)
  mentions <agent>            comments @mentioning <agent> across the project, with read state
  drift                       OPEN items naming a structural target path ABSENT from the tree
  by-commit <sha>             tickets caused-by / fixed-by <sha>
  doc-trail <id>              history events for <id>, newest first
  recent [Nd] [scope]         time-windowed digest (default ${RECENT_DAYS}d): decisions,
                              fixed, status moves, created — counts exact, lists capped
  topics                      the generated topic index — slug, first/last date, count, gist
  topic <slug>                one topic's items, oldest first (also: q --topic <slug>)
  show <id>                   print one item in full (ticket, decision, note, question) from any store
  code <text> [filters]       SEARCH CODE/DOCS/CONFIG/TICKETS (the grep replacement): ranked, compact, verified
                              filters: --regex -i -w --fuzzy  --kind code|doc|config|ticket  --lang rust
                              --path crates/sim  --not-path <glob|dir> (repeatable; drops matches)  -C n|-A n|-B n  -l (files) -c (counts) -o (matched text only)  --limit N (0=all)
                              --project <name>  search that registered project's checkout (name or id key), e.g. the kit's scripts
                              --registry <crate-version|crate>  search one dependency crate's source (cargo registry or a vendor dir), paths absolute;
                              a bare crate resolves to the one version Cargo.lock pins, e.g. q code force --registry rapier3d-0.25.1 --lang rust
  sym [<name>] [--type fn,struct,impl,use,mod,…] [--fuzzy] [--lang L] [--path P] [--not-path G] [--registry <crate>]
                              definitions, impls, uses and the mod tree (Rust, WGSL, JS/TS, Python, md, toml; Cargo.lock pins as type package, version in the scope column)
  file <substring|glob> [--not-path G]
                              find files by path across the repo and its framework submodule
  fts [--scope <s>|--project <p>] [--limit N] [--any] <q...>
                              full-text search title+body (default: this project + its adopted framework stores;
                              --project takes a registered project's name or id key, as cap does; --limit N caps hits, 0 = all;
                              --any = items holding any term; used automatically when none holds them all, plus doc/config lines);
                              then 'also in code': the few code definitions the terms name
  similar [--store <s>] <t>   likely-duplicate items (dedup, suggest-only) — cross-scope
  next-id <scope> <type>      O(1) next free id (max(num)+1)
  rundown [scope]             per-scope open-item counts (\`rundown all\` = every project)
  regressions [scope]         regression chain data (index-tickets)
  supersedes [scope]          supersede chain data (index-tickets)
  integrity                   orphan parents / dangling links / gaps — cross-scope
  sql 'SELECT ...'            ad-hoc read-only SQL
  verify [scope]              cache staleness self-check (exit 1 = stale)
  sessions [--project <s>]    list Claude Code terminal sessions, newest first (KIT-T100)
  session <id-prefix>         timestamped conversation dump of one session
  said <words...>             full-text search what was SAID across all sessions
`;

/** The entry for `verb` in the surface (its line plus indented continuations), or null when none. */
export function verbHelp(verb) {
  const lines = QUERY_SURFACE.split('\n');
  const at = lines.findIndex((l) => l.startsWith(`  ${verb} `) || l === `  ${verb}`);
  if (at < 0) return null;
  let end = at + 1;
  while (end < lines.length && CONTINUATION.test(lines[end])) end++;
  return `${lines.slice(at, end).join('\n')}\n`;
}
