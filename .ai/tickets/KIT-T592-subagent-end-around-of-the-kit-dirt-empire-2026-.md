---
id: KIT-T592
title: Subagent end-around of the kit (dirt-empire 2026-10-20, self-reported by a patch-worker/bike agent): searched with ripgrep and node scripts
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T22:53:01Z
updated: 2026-10-20T00:52:48Z
fixed_commit: b6dd07f
---

## Description
Subagent end-around of the kit (dirt-empire 2026-10-20, self-reported by a patch-worker/bike agent): searched with ripgrep and node scripts instead of q, wrote work-store files (.ai tickets/decisions) directly instead of via t, and deleted a stray __pycache__ outside the broker. Dispatch briefs said 'search with q, never grep' and no hook blocked it. Root cause to fix: enforcement gap for narrow-scope rg/node searches and direct .ai file writes from agents whose definition has no Edit/Write (they go through Bash/node), plus no check on out-of-broker deletes. Also the orchestrator used the Grep tool once on SESSION.md.

kit-bug-shape: cap:bug:subagent-end-around-of-the-kit-dirt-empire-2026-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
2026-10-20 kit agent: every gap where an agent had to go around q, t, cap or the broker, and what closed it (decision KIT-D099).

Search (q):
- grep over saved test/build output and logs (3,461 greps against 2,107 q calls in 14 days, dirt-empire): q code <text> --dir <path> [-c|-l] searches any directory or file, gitignored and out-of-repo included.
- sibling checkouts ("stiletto" failed, the key is stiletto-2349): --project takes a unique name prefix.
- the Grep tool after a blocked bash grep: query-gate now judges the Grep tool as rg.
- q code -n, -r, -H rejected and filed a ticket each time: accepted as no-ops.
- q file "**/dir/**/*.rs" empty: ** / matches zero directories.
- q open --scope X rejected: --scope/--project work on every scoped verb.
- empty answers read as proof of absence when a framework submodule was not checked out: the answer names it.
- q fts piped into head crashed (EPIPE): exits quietly.
- "cache was stale, rehydrated" noise and ~0.5 s store walk: silent; walk parallel.
- q-miss filed false "grep after empty q" tickets on shared common words: needs half the terms shared.

Work store (t):
- stale line in SESSION.md could not be corrected: t session --fix <old> <new> / --drop <text> (KIT-T593).
- decision rewritten four times with node fs: t revise <id> [--status-to] [--summary] [--file] (KIT-T589).
- inbox file renamed by hand: t triage <inbox-file> creates the ticket and files the capture.
- t new --file duplicated the template headings: a whole-ticket draft fills the sections.
- enforcement: store-shell-gate blocks shell writes of .ai and names the verb.

Tree (broker):
- stray __pycache__ deleted with rm -rf: broker.mjs clean <path> | --pycache; builds run with PYTHONDONTWRITEBYTECODE=1; patch-worker skill says run framework scripts from a scratch copy; tree-delete-gate blocks rm in a daemon-owned checkout.
- patch workers wrote envelopes with shell heredocs and node: patch-worker has a Write confined to the temp dir (pre-write refuses elsewhere).
- wait.mjs killed at 120 s with exit 137: default 100 s, exit 2.
- auto-pin never queued under land_gate: affected (silent detached refusal): carries the consumer check, logs to auto-pin.log.

Machine noise: maintenance-gaps.log (107 entries, one cause: eslint absent, logged per file) now logs once per project and tool; test runs polluted the real registry (295 dead or temp entries pruned, scripts/registry-prune.mjs) and the search log (702 fixture logs removed).

## History
- [2026-10-19 22:53] (created) bug — Subagent end-around of the kit (dirt-empire 2026-10-20, self-reported by a patch-worker/bike agent): searched with ripgrep and node scripts
- [2026-10-19 22:54] (comment) @claude: Chris 2026-10-20: the end-arounds should not be NEEDED; an agent reaching past q, t or the broker is avoiding a problem, (full comment #1 in ## Notes)
### comment #1 [2026-10-19 22:54] @claude
Chris 2026-10-20: the end-arounds should not be NEEDED; an agent reaching past q, t or the broker is avoiding a problem, not solving it. Reframe: do not only add enforcement. For each bypass find the gap in the sanctioned path that made it necessary and fix THAT: (a) search: what did rg/node answer that q could not (stale cache, narrow scope, missing flag)? (b) work store: what did a direct write or node rename do that t/cap/t move could not? (c) delete: why was a stray pycache deleted outside the broker (slow queue, no broker delete job, build tool writing it)? Enforcement comes after the gaps are closed. Sanctioned path must be at least as easy as the bypass.
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) gaps closed then enforced (decision KIT-D099): q code --dir, --project prefix, grep-habit flags, **/ globs, --scope on scoped verbs; t session --fix/--drop, t revise, t triage, t new --file whole-ticket drafts; broker clean + PYTHONDONTWRITEBYTECODE; patch-worker Write confined to temp; query-gate judges the Grep tool; store-shell-gate, tree-delete-gate, python-stdin-gate. Tests: scripts/q-gaps.test.mjs 10, t-edit-verbs.test.mjs 10, broker/clean.test.mjs 4, hooks/scratch-only.test.mjs 13, store-shell-gate.test.mjs 29, tree-delete-gate.test.mjs 12, query-gate.test.mjs. hooks.json entries for the three new gates are added after the runtime publish
