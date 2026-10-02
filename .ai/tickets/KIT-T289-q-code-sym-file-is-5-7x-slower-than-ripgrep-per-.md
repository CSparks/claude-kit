---
id: KIT-T289
title: q code/sym/file is 5-7x slower than ripgrep per call because every call re-walks and stats the whole tree (stiletto: 4,552 files, ~250 ms) before querying; the SQLite query + refresh is ~40 ms and node start ~60 ms. Replace the per-call walk with a cheap change signal (git index / git status --porcelain / fsmonitor, or a warm watcher in the kit daemon) so a warm query is under ripgrep's ~80 ms — kit-bug 2026-10-02
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T16:37:37Z
updated: 2026-10-02T16:47:28Z
---

## Description
scripts/code-index-source.mjs: one 'git status --porcelain=v2 -uall --ignore-submodules=all' per root (repo + framework submodule, run in parallel) gives HEAD + dirty paths; the index stores the last state in a meta table and re-checks dirty-now + dirty-before + git diff(oldHead,HEAD) only. Universe in git mode is tracked + untracked-not-ignored (rg semantics); non-git roots keep the walk. Work-store (ticket) stats are skipped unless the query's kinds include ticket; the meta write is skipped when nothing moved. Tests: scripts/code-index.test.mjs git-signal case (modify/add/delete/commit/checkout, warm set == full listing; 14 pass), hooks/index-redirect.test.mjs 44 pass unchanged. stiletto, same queries, ms q before -> after (rg): identifier 425 -> 233 (74), regex 577 -> 384 (69), common word 629 -> 429 (72); warm refresh alone 380 -> ~65 (git status ~40 is the floor). Floor of one call = node start ~40 + module load ~40-50 + git status ~40 + verify, so under rg's ~70 ms needs a resident process (the kit daemon, not built here); a TTL skip was rejected because an edit followed at once by a search would read a stale index. Suite 74 ok + 2 pre-existing env failures.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] warm q code call has no per-call tree walk: git status (per root, parallel) is the change signal, full walk only without git; results identical (index-redirect.test.mjs)

## Plan
1.

## History
- [2026-10-02 16:37] (created) bug — q code/sym/file is 5-7x slower than ripgrep per call because every call re-walks and stats the whole tree (stiletto: 4,552 files, ~250 ms) before querying; the SQLite query + refresh is ~40 ms and node start ~60 ms. Replace the per-call walk with a cheap change signal (git index / git status --porcelain / fsmonitor, or a warm watcher in the kit daemon) so a warm query is under ripgrep's ~80 ms — kit-bug 2026-10-02
- [2026-10-02 16:47] (comment) criterion added: warm q code call has no per-call tree walk: git status (per root, parallel) is the change signal, full walk only without git; results identical (index-redirect.test.mjs)
- [2026-10-02 16:47] (comment) ticked: warm q code call has no per-call tree walk: git status (per root, parallel) is the change signal, full walk only without git; results identical (index-redirect.test.mjs)
- [2026-10-02 16:47] (status) todo → review
