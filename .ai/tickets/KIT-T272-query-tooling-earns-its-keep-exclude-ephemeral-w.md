---
id: KIT-T272
title: Query tooling earns its keep: exclude ephemeral worktrees from the code-graph index, make the gate classify by target COVERAGE not command shape, and make a code-graph non-answer a loud NOT-INDEXED instead of a silent []
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T236, KIT-T167, KIT-T085, KIT-T168, KIT-T243, KIT-T079]
files: [scripts/code-graph.mjs, hooks/query-gate.mjs]
supersedes:
superseded_by:
fixed_commit: 807db8f
created: 2026-09-04T21:18:00Z
updated: 2026-09-04T21:33:01Z
---

## Description
Chris's verdict (2026-09-04): agents keep end-running around the code-graph/query-gate pair;
if it doesn't work it gets fixed or retired. Three measured defects against a Rust workspace +
`rapid-game` submodule (stiletto-2349):

1. **The index includes ephemeral checkouts.** `code-graph --query defines build_pieces` returned
   6 paths, 4 of them duplicates under `.claude/worktrees/agent-*/…` — ABANDONED agent worktrees.
   Root cause (reproduced in a fixture): once a worktree's `.git` link is gone it stops being a
   nested-repo boundary, so `git ls-files --others --exclude-standard` recurses into it and the
   graph indexes a twin of every file. `duplicate-defines` — the query built to tell a canonical
   module from a superseded one (KIT-T079) — is then structurally unable to do its job. Tracked
   `node_modules`/`dist`/`vendor`/`target` trees leak the same way (git list bypassed SKIP_DIRS).

2. **The gate classifies by COMMAND SHAPE, not by whether the redirect target can answer.** Four
   over-blocks in one session: `find assets/meshes -name '*raider*'` → code-graph (which has no
   filename query and indexes no assets); a heredoc `cat >> memory.md` write (KIT inbox 2026-08-31-0346);
   `.claude/worktrees` polluting the graph; `ls .ai/decisions && cat .ai/decisions/<file>` → `q`
   (which exposes neither a file's raw shape nor the next id). Any command whose SHAPE matches
   find/grep/cat over a watched path trips, regardless of whether the tool it points at covers that
   data. Recurrence class of KIT-T085 (done) / KIT-T167 (review). Fix: model each redirect target's
   COVERAGE (file types, path roots, the questions it answers) and permit anything outside it —
   never grow another exclusion list one false positive at a time.

3. **The end-around is unenforced.** The gate's block says "if code-graph errors/answers wrongly:
   HARD STOP, cap bug, fix it (KIT-T236)". In practice agents silently fall back to a permitted grep
   or the Grep tool and the failure is never filed, so the tool stays broken. KIT-T236 delivered the
   crash fix + the prose doctrine but explicitly NOT a mechanism. A silent, wrong `[]` (KIT-T168/T243)
   is the thing to make impossible: convert "can't answer" into a loud, exit-coded NOT-INDEXED so
   there is no ambiguous empty to route around.

## Acceptance Criteria
- [x] D1: `.claude/**` (agent worktrees) and tracked build/dep/vendor trees (SKIP_DIRS segments)
      are excluded from the code-graph file list in BOTH the git-aware path and the raw walk —
      an abandoned-worktree duplicate no longer appears in `defines`/`entry-points`/the file set.
- [x] D1: golden/mutation test — a fixture with `.claude/worktrees/agent-*/<dup>` yields ONE definer;
      a control with two REAL files still yields two (the exclusion is worktree-specific, not blanket dedup).
- [x] D2: `find … -name` no longer redirects to code-graph (filename lookup is outside its coverage) —
      `find assets/meshes -name '*raider*'` and `find src -name '*.ts'` pass.
- [x] D2: reading ONE specific named store file (item OR config) passes — `cat/head/sed .ai/tickets/X.md`,
      `cat .ai/decisions/X.md`; and a single-file store grep passes. Discovery over the store
      (recursive/dir/glob/multi-file search) still blocks and routes to `q`.
- [x] D2: a heredoc/redirect write (`cat >> memory.md <<EOF … .ai/… … EOF`) is not judged a store read.
- [x] D3: a code-graph query against an EMPTY index emits `NOT-INDEXED` on stderr and exits non-zero
      (never a silent `[]`); `surface`/`importers-of` on an unknown concrete path says PATH-NOT-INDEXED,
      not `[]`. The message names grep-with-`--include` as the sanctioned alternative.
- [x] The gate reads stdin robustly and FAILS OPEN — a malformed payload exits 0 (proven by a test),
      never a block, because another live session loads this hook.
- [x] Table-driven gate tests hold in BOTH directions: the must-block set (tree-wide symbol grep over
      JS/TS, store discovery search) and the must-pass set (asset find, single named store-file read,
      non-indexed-ext grep, heredoc) all green. Negative controls intact.
- [x] Kit suite run and reported with real numbers.

## Plan
1. Engine (scripts/code-graph.mjs): a `hasExcludedSegment` filter (SKIP_DIRS ∪ `.claude`) applied in
   `gitFiles` + `walk` + the html-entry list; a `coverage` summary on the graph; a NOT-INDEXED /
   PATH-NOT-INDEXED diagnostic on the query CLI (non-zero exit).
2. Gate (hooks/query-gate.mjs): RULE 1 permits one named store-file read/grep + heredoc/redirect writes,
   blocks only store DISCOVERY search; RULE 2 drops the find→code-graph branch (filename lookup is Glob's,
   not code-graph's). No new exclusion lists.
3. Tests: extend code-graph.test.mjs (worktree exclusion golden+mutation, NOT-INDEXED, path-not-found)
   and query-gate.test.mjs (the must-block/must-pass table + a malformed-payload fail-open case).
   Run the kit suite; cite counts + sha.
4. Deliver an honest earns-its-keep verdict in Notes.

## Notes

### What changed (measured before/after)

**D1 — worktree/vendored pollution (scripts/code-graph.mjs).** Root cause reproduced in a fixture:
an ABANDONED worktree loses its `.git` link and `git ls-files --others --exclude-standard` recurses
into `.claude/worktrees/agent-*/…`, so the graph indexed a twin of every file. Fix: a
`hasExcludedSegment` filter (`SKIP_DIRS ∪ {.claude}`) applied in `gitFiles`, `walk`, and the html-entry
list — closing the leak for the git list AND the raw walk, tracked or untracked.
- BEFORE: `defines build_pieces` → `[".claude/worktrees/agent-aaa/src/main.ts", "src/main.ts"]`.
- AFTER: `["src/main.ts"]`. A tracked `node_modules/**` file (which bypassed SKIP_DIRS entirely in the
  git path) is now excluded too. Mutation control proves the exclusion is worktree/vendored-specific,
  not blanket dedup — two REAL definers still both surface.

**D2 — shape-vs-coverage classifier (hooks/query-gate.mjs).** The gate matched command SHAPE and grew
an exclusion list per false positive. Reframed to the redirect target's COVERAGE:
- `find … -name` no longer redirects to code-graph — a filename lookup is outside code-graph's coverage
  entirely (it has no filename query; Glob is the tool). Removed the whole find→graph branch and its
  exclusion sub-lists. `find assets/meshes -name '*raider*'` and `find src -name '*.ts'` now pass.
- Reading/grepping ONE specific named store file (item OR config) passes — `q` exposes neither a file's
  raw shape nor the next id, and CLAUDE.md itself prescribes "Read .ai/tickets/T-001*.md". Discovery
  over the store (recursive/dir/glob/multi-file search) still routes to `q`.
- A heredoc/redirect WRITE (`cat >> memory.md <<EOF … .ai/… … EOF`) is no longer judged a store read.
- The block that EARNS its keep is untouched: a tree-wide symbol grep over JS/TS source still blocks
  (verified live this session — it correctly caught my own `grep -rln … hooks/ scripts/`).

**D3 — the unenforced end-around (scripts/code-graph.mjs).** KIT-T236 left this as prose. The durable
fix makes the silent wrong `[]` structurally impossible rather than adding another sentence: a query
against an EMPTY index now exits non-zero with `NOT-INDEXED` (naming the sanctioned `--include` grep),
and `surface`/`importers-of` on an unknown path says `PATH-NOT-INDEXED` — both distinct from a genuine
`[]`. The tool now CONCEDES when it cannot answer, so a silent fallback has nothing to hide behind, and
the gate message tells the agent a non-zero NOT-INDEXED means grep is correct (no bug to file).
Rejected alternatives: (a) gate tracking whether code-graph was attempted before permitting a fallback —
the real end-around is the Grep TOOL, which a Bash-only hook cannot see, so it can't be gated; (b) more
prose — the thing KIT-T236 already proved does not hold.

### Verdict — does the gate earn its keep? (deliverable 2)

**Qualified yes, NOW that coverage-scoping replaces shape-matching — but on probation, and one honest
gap remains.** The block has genuine, demonstrated value in JS/TS repos (it caught a real tree-wide
symbol grep of this very repo mid-session, exactly its purpose) and the store-search block routes to a
tool that truly sees links a grep misses. The four over-blocks were ALL one root cause — a shape-matcher
blind to its target's coverage — and are structurally lower now because the gate no longer redirects a
question to a tool that cannot answer it: filename lookups, single-named-file reads, heredoc writes, and
non-JS/TS greps are all OUTSIDE the two targets' coverage and now pass by construction, not by an
exclusion entry. The false-positive surface that remains is a single, honestly-bounded one: a bare
no-ext-signal grep (`rg foo src/`) in a NON-JS/TS repo still blocks conservatively, because the gate
can't cheaply prove the repo has zero JS/TS coverage per-command without a language probe. That is the
correct next lever (KIT-T168's coverage self-report, now half-built: `buildGraph` emits a `coverage`
summary the gate could read from the machine-local cache) — I did NOT bolt a fragile stat-heuristic into
a LIVE hook to chase it. If over-blocks recur after this, retire the source-discovery rule and keep only
the store-search rule (the higher-value half). I would not tell you it is fixed forever; I would tell you
it is now principled instead of accreted, and the remaining edge is named rather than papered over.

### Test evidence
- hooks/query-gate.test.mjs — 61 passed, 0 failed (must-block + must-pass table, both directions;
  malformed-payload FAIL-OPEN proven → exit 0).
- scripts/code-graph.test.mjs — 53 passed, 0 failed (worktree golden + mutation control, NOT-INDEXED,
  PATH-NOT-INDEXED, coverage summary).
- Full kit suite: 64/66 test files green. The 2 failures are PRE-EXISTING and unrelated to this work —
  `server/server.test.mjs` (missing `express` dep, env) and `scripts/agent-pins.test.mjs`
  (`agents/rg-ui-engineer.md` missing an `effort:` pin). Neither area was touched here.

## History
- [2026-09-04 21:18] (created) bug — Query tooling earns its keep: exclude ephemeral worktrees from the code-graph index, make the gate classify by target COVERAGE not command shape, and make a code-graph non-answer a loud NOT-INDEXED instead of a silent []
- [2026-09-04 21:18] (status) todo → doing
- [2026-09-04 21:31] (comment) ticked: D1: `.claude/**` (agent worktrees) and tracked build/dep/vendor trees (SKIP_DIRS segments)
- [2026-09-04 21:31] (comment) ticked: D2: `find … -name` no longer redirects to code-graph (filename lookup is outside its coverage) —
- [2026-09-04 21:31] (comment) ticked: D2: a heredoc/redirect write (`cat >> memory.md <<EOF … .ai/… … EOF`) is not judged a store read.
- [2026-09-04 21:31] (comment) ticked: The gate reads stdin robustly and FAILS OPEN — a malformed payload exits 0 (proven by a test),
- [2026-09-04 21:31] (comment) ticked: Kit suite run and reported with real numbers.
- [2026-09-04 21:32] (comment) ticked: D1: golden/mutation test — a fixture with `.claude/worktrees/agent-*/<dup>` yields ONE definer;
- [2026-09-04 21:32] (comment) ticked: D2: reading ONE specific named store file (item OR config) passes — `cat/head/sed .ai/tickets/X.md`,
- [2026-09-04 21:32] (comment) ticked: D3: a code-graph query against an EMPTY index emits `NOT-INDEXED` on stderr and exits non-zero
- [2026-09-04 21:32] (comment) ticked: Table-driven gate tests hold in BOTH directions: the must-block set (tree-wide symbol grep over
- [2026-09-04 21:33] (status) doing → review
- [2026-09-04 21:33] (comment) @claude: fixed in 807db8f — query-gate 61/61, code-graph 53/53; suite 64/66 files (2 pre-existing: express dep, agent-pins frontmatter)
