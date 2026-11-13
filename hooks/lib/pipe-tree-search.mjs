// pipe-tree-search.mjs — a search fed a whole SET of source files through a pipe (KIT-T1121). The retrieval gate
// blocks a tree-wide search by its own flags; a pipe launders the same discovery:
//   find crates -name '*.rs' | xargs grep fn          cat crates/*/src/*.rs | grep fn
//   git ls-files crates | xargs cat | grep fn         head -n 5 crates/*/src/lib.rs | grep fn
//   Get-ChildItem -Recurse crates | Select-String fn  (PowerShell: the piped files are the input)
// Allowed and not judged here: a search of ONE named file, a filter over a command's own output
// (`cargo test 2>&1 | grep -E 'FAILED' | tail -20`), and ls / wc / head / tail / cut / cat of named files or output.
//
//   pipedTreeSearch(parts) -> { search, feeder } | null   parts: shell-segments `segments()`; the piece that searches, and the one feeding it
//   targetsOnlyScratch(args) -> boolean                    every path in `args` sits in a session scratchpad (logs, never source)
//   pipedTreeMsg({ search, feeder, exact, q }) -> string   the block text: the q equivalent and the forms that stay allowed

import { classify } from '../../scripts/code-index-extract.mjs';
import { searchPaths } from './search-targets.mjs';
import { hasGlob } from './store-search.mjs';

const SEARCH = /^(?:grep|egrep|fgrep|rg|ag|ack|select-string|sls)$/;
const PS_SEARCH = /^(?:select-string|sls)$/;
const READ = /^(?:cat|head|tail|type|get-content|gc)$/;
const LISTER = /^(?:find|fd|ls|dir|tree|get-childitem|gci)$/;
const PS_PATH_FLAG = /^-(?:literal)?path$/i;
const SCRATCH = /(?:^|[\\/])scratchpad(?:[\\/]|$)/i;
const TOKENS = /"[^"]*"|'[^']*'|\S+/g;
const GLOB_EXT = /\*(\.[A-Za-z0-9]+)$/;
const MSG_WIDTH = 120;
const unquote = (a) => a.replace(/^["']|["']$/g, '');
const baseName = (word) => unquote(word).replace(/.*[\\/]/, '').toLowerCase();

export function targetsOnlyScratch(args) {
  const paths = args.map(unquote).filter((a) => /[\\/]/.test(a));
  return paths.length > 0 && paths.every((a) => SCRATCH.test(a));
}

function parseCall({ text, after }) {
  let words = text.trim().match(TOKENS) || [];
  let viaXargs = false;
  if (baseName(words[0] || '') === 'xargs') {
    viaXargs = true;
    words = words.slice(1);
    while (words.length && words[0].startsWith('-')) words.shift();
  }
  const tool = baseName(words[0] || '');
  const gitLsFiles = tool === 'git' && unquote(words[1] || '') === 'ls-files';
  return { text: text.trim(), after, tool: gitLsFiles ? 'ls-files' : tool, args: words.slice(1).map(unquote), viaXargs };
}

const lists = (c) => Boolean(c) && (LISTER.test(c.tool) || c.tool === 'ls-files' || (c.tool === 'rg' && c.args.includes('--files')));
const hasFileOperand = (c) => (PS_SEARCH.test(c.tool) ? c.args.some((a) => PS_PATH_FLAG.test(a)) : searchPaths(c.args).length > 0);

// A reader that streams many files: a glob operand, or no operand with a lister before it.
const readsMany = (c, before) => READ.test(c.tool) && (c.args.some(hasGlob) || (!c.args.some((a) => !a.startsWith('-')) && lists(before)));

// Files of a kind the index does not hold (*.log, *.txt) are build output, not source: a glob naming only those passes.
const notSource = (calls) => {
  const tokens = calls.flatMap((c) => c.args);
  const hints = tokens.map((t) => GLOB_EXT.exec(t)).filter(Boolean).map((m) => m[1]);
  return (hints.length > 0 && hints.every((h) => !classify(`x${h}`))) || targetsOnlyScratch(tokens);
};

export function pipedTreeSearch(parts) {
  const calls = [...parts].map(parseCall);
  for (let i = 1; i < calls.length; i++) {
    const c = calls[i];
    if (c.after !== '|' || !SEARCH.test(c.tool) || hasFileOperand(c)) continue;
    const feeder = calls[i - 1];
    const before = calls[i - 2];
    const fed = c.viaXargs ? lists(feeder) : (PS_SEARCH.test(c.tool) && lists(feeder)) || readsMany(feeder, before);
    if (fed && !notSource([feeder, ...(before ? [before] : [])])) return { search: c.text, feeder: feeder.text };
  }
  return null;
}

const trunc = (s) => (s.length > MSG_WIDTH ? `${s.slice(0, MSG_WIDTH - 3)}...` : s);

export function pipedTreeMsg({ search, feeder, exact, q }) {
  return [
    '',
    'BLOCKED: searching a set of source files through a pipe (the file list or glob feeds the search).',
    `  ${trunc(feeder)}  |  ${trunc(search)}`,
    '',
    ...exact,
    'The same discovery, ranked and compact:',
    `  node "${q}" code <text> [--lang L] [--path P] [--regex -i -w -C 2]`,
    '',
    'Still allowed:',
    '  one named file:         grep <pattern> <file>   (or the Read tool)',
    "  a command's own output: cargo test 2>&1 | grep -E 'test result|FAILED' | tail -20   (head, tail, cut, wc filter output freely)",
    `  logs and scratch files: node "${q}" code <text> --dir <path>`,
    'If q ERRORS or answers wrongly: HARD STOP — `cap bug <what failed>`, then fix it (KIT-T236).',
    '',
  ].join('\n');
}
