---
id: KIT-T705
title: source-shell-gate gap 1: segments() in hooks/lib/shell-segments.mjs does not handle backslash escapes. A backslash before a quote can mis-sp
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:52:46Z
updated: 2026-10-29T17:41:15Z
fixed_commit: ce5747f
---

## Description
source-shell-gate gap 1: segments() in hooks/lib/shell-segments.mjs does not handle backslash escapes. A backslash before a quote can mis-split the segments and hide a non-redirect write tool (sed -i, tee, rm …) in the wrong segment. Raw redirect scanning is unaffected. Reported by the KIT-T701 writer, 2026-10-29, runtime 7d9f457. Fix: escape-aware segmenting, falling back to treating the whole command as one segment when the quoting is ambiguous.

kit-bug-shape: cap:bug:source-shell-gate-gap-1-segments-in-hooks-lib-sh
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 16:52] (created) bug — source-shell-gate gap 1: segments() in hooks/lib/shell-segments.mjs does not handle backslash escapes. A backslash before a quote can mis-sp
- [2026-10-29 17:05] (status) todo → done
- [2026-10-29 17:05] (comment) @claude: Tests: hooks/shell-segments.test.mjs 14 passed, hooks/source-shell-gate.test.mjs 127 passed, hooks/branch-guard.test.mjs (full comment #1 in ## Notes)
### comment #1 [2026-10-29 17:05] @claude
Tests: hooks/shell-segments.test.mjs 14 passed, hooks/source-shell-gate.test.mjs 127 passed, hooks/branch-guard.test.mjs 44 passed. Ambiguous quoting returns every distinct split plus the whole command as a last flagged segment, not one segment alone: one segment would hand branch-guard and the leader-exempt readers a bypass.
- [2026-10-29 17:05] (landed) c7f49ad implements KIT-T705: segments() resolves escaped quotes; ambiguous quoting fails closed
- [2026-10-29 17:12] (landed) aa90faf implements KIT-T705: segments() flags a line with an escape before a quote, a dollar-quote string or an unclosed quote a
- [2026-10-29 17:22] (landed) 2135f21 implements KIT-T705: an ambiguous line yields a candidate segment from each word, so leader-reading gates see a command
- [2026-10-29 17:34] (landed) ce5747f implements KIT-T705: ambiguous quoting flags the segments() result and every deny gate fails closed on its own target wo
- [2026-10-29 17:41] (status) done → done
- [2026-10-29 17:41] (comment) @claude: Final shape (ce5747f): segments() returns the plain split flagged ambiguous; every deny gate tests its own target words  (full comment #2 in ## Notes)
### comment #2 [2026-10-29 17:41] @claude
Final shape (ce5747f): segments() returns the plain split flagged ambiguous; every deny gate tests its own target words in the raw command and blocks. Tests: hooks/shell-segments.test.mjs 13, source-shell-gate 123, store-shell-gate 32, branch-guard 46, query-gate all pass, tree-delete-gate 27, upstream-gate 38, broker-log-gate 19, python-stdin-gate 41, wait-poll 26.
