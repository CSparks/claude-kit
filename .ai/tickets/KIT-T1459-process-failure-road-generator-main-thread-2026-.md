---
id: KIT-T1459
title: process failure (road-generator, main thread 2026-11-20): closing status reply listed 'Your calls, not pending on me' naming four owner deci
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-21T05:36:15Z
updated: 2026-11-21T05:41:03Z
---

## Description
process failure (road-generator, main thread 2026-11-20): closing status reply listed 'Your calls, not pending on me' naming four owner decisions in prose with no AskUserQuestion; prose-ask Stop gate did not block the plural noun form 'Your calls'. Root cause: gate phrase list matches 'your call' / 'up to you' forms but not 'Your calls' used as a list heading, and the coordinator did not self-check. Fix: extend prose-ask to plural/heading forms, and add a pre-reply self-check line to the coordinator contract.

kit-bug-shape: cap:bug:process-failure-road-generator-main-thread-2026-:a2e26a24
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] prose-ask blocks 'Your calls' lead-ins, his/the maintainer's call, yours to decide, pending your decision (hooks/prose-ask-gate.test.mjs 232 passed)
- [x] base CLAUDE.md (user-config/CLAUDE.global.md) carries the pre-reply self-check line

## Plan
1.

## Notes
Landed 9677c2bc (pushed, runtime published): prose-ask hard phrases now cover 'Your calls' lead-in (your/his/Chris's/the maintainer's), his/the maintainer's call, yours to decide, pending your decision. hooks/prose-ask-gate.test.mjs 232 passed, 0 failed (was 207 passed, 25 failed before the matcher change); gate-protocol 57 passed; contract-rules 48 passed. Coordinator contract self-check line added to user-config/CLAUDE.global.md.

## History
- [2026-11-21 05:36] (created) bug — process failure (road-generator, main thread 2026-11-20): closing status reply listed 'Your calls, not pending on me' naming four owner deci
- [2026-11-21 05:39] (landed) 9677c2bc prose-ask: "Your calls" lead-in, his/the maintainer's call, yours to decide, pending your decision are hard asks (implem
- [2026-11-21 05:40] (comment) criterion added: prose-ask blocks 'Your calls' lead-ins, his/the maintainer's call, yours to decide, pending your decision (hooks/prose-ask-gate.test.mjs 232 passed)
- [2026-11-21 05:40] (comment) criterion added: base CLAUDE.md (user-config/CLAUDE.global.md) carries the pre-reply self-check line
- [2026-11-21 05:40] (comment) ticked: prose-ask blocks 'Your calls' lead-ins, his/the maintainer's call, yours to decide, pending your decision (hooks/prose-ask-gate.test.mjs 232 passed)
- [2026-11-21 05:40] (comment) ticked: base CLAUDE.md (user-config/CLAUDE.global.md) carries the pre-reply self-check line
- [2026-11-21 05:41] (status) todo → review
