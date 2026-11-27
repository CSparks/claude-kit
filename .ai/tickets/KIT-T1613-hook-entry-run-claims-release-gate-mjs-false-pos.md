---
id: KIT-T1613
title: hook-entry-run (claims-release-gate.mjs) false positive: it refuses 'node --check hooks/dispatch-guard.mjs', a syntax check that parses the
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T19:31:50Z
updated: 2026-11-27T19:55:08Z
---

## Description
hook-entry-run (claims-release-gate.mjs) false positive: it refuses 'node --check hooks/dispatch-guard.mjs', a syntax check that parses the file and never runs it or feeds it a payload. Root cause: the hook-entry detector matches any node invocation naming a hooks/*.mjs entry without reading node flags that do not execute (--check / -c). Fix: exempt --check/-c (and nothing that executes); a test with both the syntax check (passes) and a plain run (still blocks). Seen by the KIT-T1611 builder agent.

kit-bug-shape: cap:bug:hook-entry-run-claims-release-gate-mjs-false-pos:17ada25e
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-27 19:31] (created) bug — hook-entry-run (claims-release-gate.mjs) false positive: it refuses 'node --check hooks/dispatch-guard.mjs', a syntax check that parses the
- [2026-11-27 19:53] (landed) 0d05d58c hook-entry-run: exactly `node --check <one .mjs path>` passes, a parse that runs nothing; a chained run, a pipe, a redir
- [2026-11-27 19:55] (status) todo → review
- [2026-11-27 19:55] (comment) @claude: fixed in 0d05d58c: exactly node --check <one .mjs path> passes; chained, piped, redirected, two-path, env-prefixed, --im (full comment #1 in ## Notes)
### comment #1 [2026-11-27 19:55] @claude
fixed in 0d05d58c: exactly node --check <one .mjs path> passes; chained, piped, redirected, two-path, env-prefixed, --import, -e, -c and bash -c forms stay refused. -c left refused per the brief's exact wording. hook-entry-run.test.mjs 40 checks pass.
