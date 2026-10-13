---
id: KIT-T450
title: Kit writers edit the live scripts every session executes: while a writer had q-lib.mjs / t.mjs half-edited (2026-10-13 ~14:00-15:00), q code
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T19:51:48Z
updated: 2026-10-13T20:34:07Z
---

## Description
Kit writers edit the live scripts every session executes: while a writer had q-lib.mjs / t.mjs half-edited (2026-10-13 ~14:00-15:00), q code|file threw SyntaxError at q-lib.mjs:253 and a missing ftsDocLines export, and t comment threw ESM load errors, in every other session (stiletto-2349 audit agents lost q twice; ticket writes failed). Root cause: no staging between a kit writer's working edits and the scripts all sessions run; the fix is a stable runtime copy (or edit-in-temp-then-atomic-swap) that only updates on a green npm test.

kit-bug-shape: cap:bug:kit-writers-edit-the-live-scripts-every-session-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-13 19:51] (created) bug — Kit writers edit the live scripts every session executes: while a writer had q-lib.mjs / t.mjs half-edited (2026-10-13 ~14:00-15:00), q code
- [2026-10-13 19:52] (comment) seen again in stiletto-2349: Kit writers edit the live scripts every session runs: while a writer had q-lib.mjs and t.mjs half-edited (2026-10-13 ~14:00-15:00), q code|file threw SyntaxError at q-lib.mjs:253 and a missing ftsDocLines export, and t comment threw ESM load errors in every other session (stiletto audit agents lost
- [2026-10-13 19:52] (asked again) 2026-10-13 — cap:bug:kit-writers-edit-the-live-scripts-every-session-
- [2026-10-13 20:34] (status) todo → review
- [2026-10-13 20:34] (comment) 4ac3ce2; scripts/runtime-publish.test.mjs 7 passed; npm test exit 0. Sessions adopt it by running kit scripts from ~/.claude/claude-kit-runtime/current
- [2026-10-13 21:07] (comment) @claude: Decided 2026-10-13 (KIT-D092): sessions run the kit from the tested, published runtime copy, not the live checkout. Chri (full comment #1 in ## Notes)
### comment #1 [2026-10-13 21:07] @claude
Decided 2026-10-13 (KIT-D092): sessions run the kit from the tested, published runtime copy, not the live checkout. Chris: "Run from tested copy". Wiring is KIT-T460: bootstrap, dev-link and the composed CLAUDE.md point at ~/.claude/claude-kit-runtime/current; npm run publish:runtime is the only way current moves.
