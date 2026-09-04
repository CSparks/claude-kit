#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — the RETRIEVAL gate. The failure it fixes (lived,
// 2026-06-06): an agent hand-greps the .ai/ work store for decisions/tickets/history,
// or greps the source tree to DISCOVER code — instead of querying the layers built
// for exactly that. `q` (the KIT-T004 cache) and `code-graph` (KIT-T012) are faster
// and see the links/graph a raw grep is blind to. Instructions are advisory and a
// blank context blows past them; this closes the shell path so the wrong action is
// impossible, not merely discouraged ("enforcement is hooks, not judgment").
//
//   - a text tool searching/reading the .ai store      -> BLOCK, hand back the `q` query
//   - a recursive / tree-wide source search (discovery) -> BLOCK, hand back code-graph
//
// ALLOWED (the maintainer's rule — grep is fine when you know exactly where + what):
//   - a targeted grep of a SPECIFIC named file
//   - piped filtering of a command's OUTPUT (`q sql ... | grep x`, `git log | grep y`)
//
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fail-open on any error.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';

const KIT = dirname(dirname(fileURLToPath(import.meta.url)));
const Q = join(KIT, 'scripts', 'q.mjs');
const GRAPH = join(KIT, 'scripts', 'code-graph.mjs');

// Text tools that READ/SEARCH file CONTENT (the wrong path for store + discovery).
const SEARCH = /^(?:grep|egrep|fgrep|rg|ag|ack|sed|awk|findstr|select-string|sls)$/;
const READ = /^(?:cat|head|tail|type|get-content|gc)$/;
// Anything in the .ai work store — the data `q` owns. Tickets/decisions/etc. may also
// be referenced bare (a `cd` already inside .ai), so match the store dirs at TOKEN START
// only — `src/notes/` is a legit user directory, not the store (KIT-T056). The
// `projects/<name>/<store>` form covers centralized data roots (no `.ai` in the path).
const STORE = /\.ai[\\/]|(?:^|[\s"'=])\.?[\\/]?(?:tickets|decisions|inbox|questions|notes)[\\/]|[\\/]projects[\\/][^\\/\s"']+[\\/](?:tickets|decisions|inbox|questions|notes)[\\/]|\b(?:ROADMAP|DECISIONS)\.md\b/i;
// A recursive/tree-wide grep is DISCOVERY ("find me where X is"), the code-graph's job.
const RECURSIVE_FLAG = /(?:^|\s)(?:-[A-Za-z]*[rR][A-Za-z]*|--recursive|--include\b|--include-dir\b)/;
const FILEISH = /\.[A-Za-z0-9]{1,6}$/; // a concrete file arg (has an extension)
// Extensions code-graph DOES index (JS/TS ecosystem). Tree-wide greps over these extensions
// are discovery — code-graph can answer them. All other source extensions (Rust, WGSL,
// GLSL, Python, …) are NOT indexed, so blocking them is a dead end with no sanctioned
// alternative — those greps must be allowed (KIT-T085).
const GRAPH_INDEXED_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue', '.svelte']);
// Detects --include=*.rs / --include=*.wgsl / -g '*.rs' style glob flags, or a path/dir
// argument that ends in a non-indexed extension or a dir segment that implies one
// (e.g. `src/shaders/` cannot signal ext, but `**/*.rs` can). Also matches `rg -t rust`.
// Strategy: extract every argument token; if ALL extension hints found are non-indexed
// (i.e. no indexed extension appears in the token set), allow the grep. When there is NO
// extension signal at all, keep the current behaviour (block) — unknown → conservative.
// Workflow DATA, not source (KIT-T167): a `.ai` store or the central claude-kit-data projects
// tree. Inventorying those is exactly what the .ai contract asks for at session start, and
// code-graph indexes none of it — so `source-discovery` must never claim them. RULE 1
// (store-grep) stays the arbiter for those paths and points at `q`.
const WORKFLOW_DATA = /(?:^|[\\/\s"'=])(?:\.ai|claude-kit-data)(?:[\\/]|$)/i;
function targetsWorkflowData(c) {
  return c.split(/\s+/)
    .map((t) => t.replace(/^["']|["']$/g, ''))
    .some((t) => t && !t.startsWith('-') && WORKFLOW_DATA.test(t));
}

function targetsOnlyNonIndexedExtensions(c) {
  // Collect extension hints from --include / -g / -e flags and from path-ish tokens.
  const exts = new Set();
  // --include=*.rs  --include *.wgsl  -g '*.rs'  globs in the command
  for (const m of c.matchAll(/(?:--include|--glob|-g)\s*[=\s]?["']?\*(\.[A-Za-z0-9]+)["']?/gi)) {
    exts.add(m[1].toLowerCase());
  }
  // rg --type / -t <langname>  (e.g. `rg -t rust foo`)
  for (const m of c.matchAll(/(?:-t|--type)\s+([A-Za-z0-9]+)/gi)) {
    const lang = m[1].toLowerCase();
    // Map known rg type-names that are non-indexed source langs.
    if (['rust', 'wgsl', 'glsl', 'hlsl', 'py', 'python', 'c', 'cpp', 'go', 'java', 'kotlin', 'swift', 'ruby', 'sh', 'bash', 'fish', 'toml', 'yaml'].includes(lang)) {
      exts.add('.' + (lang === 'python' ? 'py' : lang === 'bash' ? 'sh' : lang));
    }
    if (['js', 'javascript', 'ts', 'typescript'].includes(lang)) exts.add('.js');
  }
  // Path tokens like `**/*.rs` or `src/*.wgsl`
  for (const m of c.matchAll(/\*(\.[A-Za-z0-9]+)\b/gi)) {
    exts.add(m[1].toLowerCase());
  }
  // A path argument ending in a source extension (e.g. `grep foo crates/` has no ext hint,
  // but `grep -r foo crates/*.rs` does via the glob above; plain dir paths give no signal).
  if (exts.size === 0) return false; // no signal — keep current behaviour (block)
  const hasIndexed = [...exts].some((e) => GRAPH_INDEXED_EXTS.has(e));
  return !hasIndexed; // ALL hints are non-indexed → allow
}

main().catch(() => process.exit(0)); // fail-open — never wedge a tool call on a parse slip

async function main() {
  const p = await payload();
  const cmd = ((p.tool_input && p.tool_input.command) || '').trim();
  if (!cmd) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0); // opt-in: only KIT-adopted repos

  // Judge EVERY segment, not just the leader (KIT-T056 — `true || grep .ai/` escaped).
  // A segment after a single `|` receives the previous command's OUTPUT, so a search
  // tool there with no path-ish args is filtering text (allowed); `||`/`&&`/`;` chains
  // run against the FILESYSTEM and are judged in full.
  for (const { text, after } of segments(cmd)) {
    const c = text.trim();
    if (!c) continue;
    const verdict = judge(c, after === '|');
    if (verdict) {
      // KIT-T051 exclusion: a path glob under the verdict's check-id in
      // .claude-kit-ignore.yaml lets a command through (e.g. allow grepping a generated
      // tree). Match any path-ish token in the command against that id. Fail-open.
      if (excludedByConfig(root, verdict.id, c)) continue;
      process.stderr.write(verdict.msg + excludeFooter(verdict.id));
      process.exit(2);
    }
  }
  process.exit(0);
}

// Split a shell line into segments, each tagged with the operator BEFORE it ('start',
// '|', '||', '&&', ';', '&'). Quote-aware so operators inside strings don't split.
function segments(cmd) {
  const out = [];
  let cur = '';
  let op = 'start';
  let q = '';
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '|' || ch === '&' || ch === ';') {
      const pair = ch + (cmd[i + 1] || '');
      const sep = pair === '||' || pair === '&&' ? pair : ch;
      if (sep.length === 2) i++;
      out.push({ text: cur, after: op });
      cur = '';
      op = sep;
      continue;
    }
    cur += ch;
  }
  out.push({ text: cur, after: op });
  return out;
}

// True iff any path-ish argument in the command is excluded from `id` by a config glob.
function excludedByConfig(root, id, c) {
  try {
    const toks = c.split(/\s+/).filter((t) => t && !t.startsWith('-') && /[\\/.]/.test(t));
    return toks.some((t) => pathExcluded(root, id, t.replace(/^["']|["']$/g, '')));
  } catch {
    return false;
  }
}

// Return a block message, or null to allow. One simple command (no pipe/chain).
// `piped` = this segment reads the previous command's stdout.
function judge(c, piped = false) {
  let tok = c.split(/\s+/).filter(Boolean);
  if (!tok.length) return null;
  let tool = tok[0].replace(/.*[\\/]/, '').toLowerCase(); // basename, lower
  // xargs feeds stdin as FILENAMES to its command — that command reads files, so
  // unwrap and judge IT, un-piped (`find ... | xargs grep x` is discovery, not a filter).
  if (tool === 'xargs') {
    tok = tok.slice(1);
    while (tok.length && tok[0].startsWith('-')) tok.shift();
    if (!tok.length) return null;
    tool = tok[0].replace(/.*[\\/]/, '').toLowerCase();
    c = tok.join(' ');
    piped = false;
  }
  const gitGrep = tool === 'git' && (tok[1] || '').toLowerCase() === 'grep';
  const isSearch = SEARCH.test(tool) || gitGrep;
  const isRead = READ.test(tool);
  const isFind = tool === 'find' || tool === 'get-childitem' || tool === 'gci';
  // A piped search/read with no FILE argument is filtering the previous command's
  // OUTPUT — the explicitly-allowed case. Patterns must not count as paths: quoted
  // spans are stripped (regexes carry \d, alternation /) and the first bare positional
  // of a search tool is its pattern. (find/gci never filter stdin — no exemption.)
  if (piped && (isSearch || isRead)) {
    const unquoted = c.replace(/"[^"]*"|'[^']*'/g, ' ');
    const positionals = unquoted.split(/\s+/).filter(Boolean).slice(gitGrep ? 2 : 1).filter((a) => !a.startsWith('-'));
    const fileArgs = isRead ? positionals : positionals.slice(1);
    if (!fileArgs.some((a) => /[\\/]/.test(a))) return null;
  }

  // RULE 1 — the work store is `q`'s to SEARCH. A text tool doing DISCOVERY over it (recursive /
  // dir / glob / multi-file / find) routes to q, which sees the links+history a grep is blind to.
  // Coverage-scoped (KIT-T272): `q` does NOT expose a file's raw shape, the next id, or a directory
  // listing — so reading/grepping ONE specific named store file (item OR config: the maintainer's
  // "you know exactly where + what" case, KIT-T080) is correct via the Read/Grep tools and must pass,
  // and a heredoc/redirect WRITE whose body merely names a store path is not a store read at all
  // (the memory-file false positive, inbox 2026-08-31-0346).
  const isStoreWrite = isRead && /(?:>>?|<<)/.test(c.replace(/'[^']*'|"[^"]*"/g, ' '));
  if ((isSearch || isRead || isFind) && STORE.test(c) && !isStoreWrite) {
    // A search tool's first positional is its pattern, not a path; flag VALUES (`head -n 50`) aren't
    // FILEISH — so count the concrete store FILES among the args, not bare positionals.
    const positionals = (gitGrep ? tok.slice(2) : tok.slice(1))
      .filter((a) => !a.startsWith('-')).map((a) => a.replace(/^["']|["']$/g, ''));
    const storeFiles = positionals.filter((a) => STORE.test(a) && FILEISH.test(a));
    // ONE specific named file (no find, no recursion) — read/grep it directly; q can't return its raw
    // form. Discovery (find, recursion, a store dir, a glob, or >1 concrete file) stays q's to answer.
    const oneNamedFile = !isFind && !RECURSIVE_FLAG.test(c) && storeFiles.length === 1;
    if (!oneNamedFile) return { id: 'store-grep', msg: storeMsg(c) };
  }

  // RULE 2 — discovery search of the source tree belongs to the code graph.
  // EXCEPTION (KIT-T085): when the grep explicitly targets file types that code-graph does
  // NOT index (Rust .rs, WGSL .wgsl, and all other non-JS/TS source), the redirect is a dead
  // end — code-graph has no answer for those symbols. Allow such greps so the agent isn't
  // stranded. If there is NO extension signal (no --include / glob / -t flag), keep blocking
  // (conservative — unknown scope still routes to code-graph for JS/TS discovery).
  if (isSearch) {
    const args = (gitGrep ? tok.slice(2) : tok.slice(1)).filter((a) => !a.startsWith('-'));
    const targetsOneFile = args.some((a) => FILEISH.test(a)); // a concrete file = "you know where"
    const recursive = RECURSIVE_FLAG.test(c) || tool === 'rg' || tool === 'ag' || tool === 'ack' || gitGrep;
    if (recursive && !targetsOneFile) {
      if (targetsWorkflowData(c)) return null;             // workflow data — RULE 1's business
      if (targetsOnlyNonIndexedExtensions(c)) return null; // code-graph can't help — allow
      return { id: 'source-discovery', msg: graphMsg(c) };
    }
  }
  // A `find … -name/-path` is a FILENAME lookup — OUTSIDE code-graph's coverage entirely (it answers
  // symbols/imports/surface, never "which files are named X"). Redirecting it to code-graph was always
  // a dead end (asset/data dirs, non-JS/TS, and every filename query alike — KIT-T272). The tool that
  // covers filename patterns is Glob; the agent may use it or `find` freely. `find` over the .ai store
  // stays RULE 1's business (q enumerates items). So the gate no longer blocks source `find`.

  return null;
}

function storeMsg(c) {
  return [
    '',
    'BLOCKED: searching the .ai work store with a text tool.',
    `  ${trunc(c)}`,
    '',
    'Query the work graph instead — it knows the links/history a grep is blind to:',
    `  node "${Q}" governing <path>     # OPEN tickets/decisions governing a file`,
    `  node "${Q}" trail <id>           # walk UP an id to its governing decisions/origin`,
    `  node "${Q}" fts <terms...>       # full-text search title+body across stores`,
    `  node "${Q}" open [scope]         # open items (todo|doing|review)`,
    `  node "${Q}" inbox [scope]        # untriaged captures, with age + file path`,
    `  node "${Q}" confirmations        # captures aged past the confirmation threshold`,
    `  node "${Q}" doc-trail <id>       # an item's history, newest first`,
    `  node "${Q}" --help               # the full query surface`,
    '',
    'This gate is the enforcement, not memory. (Read the q output, not the files.)',
    'If q ERRORS or answers wrongly: HARD STOP — `cap bug <what failed>`, then fix it. Never',
    'silently fall back to grep (KIT-T236).',
    'For ONE specific config/state file (e.g. config.yml, SESSION.md) read it directly with the Read',
    'tool — q does not index those; it is for tickets/decisions/questions.',
    '',
  ].join('\n');
}

function graphMsg(c) {
  return [
    '',
    'BLOCKED: grepping the source tree to discover code.',
    `  ${trunc(c)}`,
    '',
    'Query the code graph FIRST — it resolves imports/symbols/surface without opening files:',
    `  node "${GRAPH}" --query importers-of <path>       # who imports X`,
    `  node "${GRAPH}" --query defines <symbol>           # where Y is defined`,
    `  node "${GRAPH}" --query surface <path>             # a module's public surface`,
    `  node "${GRAPH}" --query duplicate-defines <symbol> # TWINS of Y — flags the superseded one`,
    `  node "${GRAPH}" --query entry-points               # app roots (multi-root = two apps)`,
    '',
    'If code-graph ERRORS or answers wrongly: HARD STOP — `cap bug <what failed>`, then fix it.',
    'Falling back to grep instead of filing the failure is how the tool stays broken (KIT-T236).',
    'A non-zero exit with NOT-INDEXED / PATH-NOT-INDEXED means code-graph does not cover this repo/path',
    '(NOT "no match") — grep is then the correct tool, no bug to file (KIT-T272).',
    '',
    'Module-identity / "X isn\'t showing / which file?" → PROVENANCE FIRST, not runtime theories:',
    '  git log -- <path>   +   duplicate-defines / entry-points above   (KIT-T079).',
    '',
    'For a TARGETED look once you know the file, use the Grep/Glob/Read tools',
    '(not Bash grep). A bare `grep <pattern> <one-specific-file>` is allowed.',
    '',
    'NOTE: greps restricted to non-JS/TS source (--include=*.rs, --include=*.wgsl, -t rust, etc.)',
    'are ALLOWED — code-graph only indexes JS/TS and cannot redirect those queries (KIT-T085).',
    '',
  ].join('\n');
}

const trunc = (s) => (s.length > 120 ? s.slice(0, 117) + '...' : s);
