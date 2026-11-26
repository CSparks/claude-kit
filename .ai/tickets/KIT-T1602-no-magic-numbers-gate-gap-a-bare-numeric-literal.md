---
id: KIT-T1602
title: no-magic-numbers gate gap: a bare numeric literal in a new .tsx written with the Write tool (fleet-desktop src/patterns/SessionStatus.tsx, a
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T07:03:19Z
updated: 2026-11-26T07:08:28Z
---

## Description
no-magic-numbers gate gap: a bare numeric literal in a new .tsx written with the Write tool (fleet-desktop src/patterns/SessionStatus.tsx, an icon size) passed, while the same literal in an Edit to LaunchActions.tsx was blocked. Root cause to confirm: the magic-number check runs on Edit new_string but not (or not the same way) on Write content.

kit-bug-shape: cap:bug:no-magic-numbers-gate-gap-a-bare-numeric-literal:005104cf
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Root cause (from the subagent transcript agent-acf2bd03060f34f3d): not Write versus Edit. The Write's rows read 'blocked: { accent: "var(--color-state-attention)", icon: <CircleAlert size={14} .../> ... }'. The declaration skip matched \bvar\b in the raw line (the CSS var() string), and a row starting 'name:' was skipped whole; the Edit line '<ArrowRight size={14} .../>' had neither. Also firstMagicLiteral judged only the first literal, so f(0, 14) passed. Fix (hooks/lib/pre-write-numbers.mjs, hooks/pre-write.mjs): the declaration keyword is read from the string-blanked code and needs a name after it; named values (key: n, x = n, key: [n, m]) are cut and the rest of the line judged; every literal is judged. Tests: new hooks/pre-write-magic-write.test.mjs 11 passed 2 failed without the change, 13 passed 0 failed with it; pre-write.test 75 passed. Widening: any line with a non-trivial literal after a trivial one, or a literal beyond a key's own value, now blocks in every repo.

## History
- [2026-11-26 07:03] (created) bug — no-magic-numbers gate gap: a bare numeric literal in a new .tsx written with the Write tool (fleet-desktop src/patterns/SessionStatus.tsx, a
- [2026-11-26 07:08] (status) todo → review
