---
id: KIT-T867
title: AskUserQuestion question-brief gate (KIT-D129/T846) reports 'reply has no text block' and 'option Ignore not named' although the same reply
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T872
created: 2026-11-06T20:39:43Z
updated: 2026-11-06T20:39:43Z
---

## Description
AskUserQuestion question-brief gate (KIT-D129/T846) reports 'reply has no text block' and 'option Ignore not named' although the same reply carried a full brief (decision/evidence/options/recommendation/not asked) naming all three options; blocked 3 times in one turn

kit-bug-shape: cap:bug:askuserquestion-question-brief-gate-kit-d129-t84
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-06 20:39] (created) bug — AskUserQuestion question-brief gate (KIT-D129/T846) reports 'reply has no text block' and 'option Ignore not named' although the same reply
- [2026-11-06 21:54] (landed) a9382a4 question-brief-gate: a call whose own reply is not in the transcript yet is told to resend unchanged, never that its rep
- [2026-11-06 21:59] (status) todo → superseded (by KIT-T872)
- [2026-11-06 22:00] (comment) @kit-agent: Same fault as KIT-T872 (fix a9382a4); the three blocked replies held only thinking blocks (pixelvision 0c60656b entries 486, 494, 506). See KIT-T872 Notes.
