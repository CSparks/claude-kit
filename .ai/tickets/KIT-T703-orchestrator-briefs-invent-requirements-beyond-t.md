---
id: KIT-T703
title: Orchestrator briefs invent requirements beyond the maintainer's words: DE-T195 'MX track class with higher hills and jumps' was built as a s
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T16:38:39Z
updated: 2026-11-01T23:23:26Z
---

## Description
Orchestrator briefs invent requirements beyond the maintainer's words: DE-T195 'MX track class with higher hills and jumps' was built as a separate MX layout path (trivial triangle/rectangle plans) instead of the stadium layout generator with MX leg profiles, and the DE-T227 fix brief again asked for new 'real motocross layouts' instead of reusing the stadium generator. Root cause: a brief restates the ask in its own words and adds scope; nothing checks the brief against the maintainer's verbatim words or forces 'which existing mechanism does this reuse' for a variant of an existing feature. Chris 2026-10-29: 'I DIDN'T FUCKING SAY THE MX TRACKS NEEDED A DIFFERENT FUCKING LAYOUT THAN THE STADIUM FUCKING TRUCKS.'

kit-bug-shape: cap:bug:orchestrator-briefs-invent-requirements-beyond-t
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Handoff (standing kit agent, context limit). Jobs: KIT-T703 brief-invents-requirements gate. State: claimed, no code written. Design considered: a dispatch-guard check (check-id brief-grounded, new hooks/dispatch-brief.mjs beside dispatch-lessons.mjs) that, for a brief citing a ticket whose type is feature or request, requires a quoted maintainer sentence token (maintainer-words) and, when the ticket title names a variant of an existing feature, a reuses token naming the existing mechanism; blocks otherwise with the DE-T195 MX/stadium example. Open decision for the maintainer: block or warn, and which ticket types. Next: confirm the gate shape with the maintainer, then write hooks/dispatch-brief.mjs plus tests in hooks/dispatch-guard.test.mjs. Files: hooks/dispatch-guard.mjs, hooks/dispatch-lessons.mjs (pattern to copy).

## History
- [2026-10-29 16:38] (created) bug — Orchestrator briefs invent requirements beyond the maintainer's words: DE-T195 'MX track class with higher hills and jumps' was built as a s
- [2026-11-01 23:23] (status) todo → doing
