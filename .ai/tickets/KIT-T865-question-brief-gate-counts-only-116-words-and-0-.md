---
id: KIT-T865
title: question-brief-gate counts only 116 words and 0 evidence/options in a reply whose prose brief is in the PRECEDING text block of the same tur
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T872
created: 2026-11-06T00:40:37Z
updated: 2026-11-06T00:40:37Z
---

## Description
question-brief-gate counts only 116 words and 0 evidence/options in a reply whose prose brief is in the PRECEDING text block of the same turn; blocks every AskUserQuestion (stiletto-2349, 2026-11-05, 5th occurrence)

kit-bug-shape: cap:bug:question-brief-gate-counts-only-116-words-and-0-
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-06 00:40] (created) bug — question-brief-gate counts only 116 words and 0 evidence/options in a reply whose prose brief is in the PRECEDING text block of the same tur
- [2026-11-06 21:54] (landed) a9382a4 question-brief-gate: a call whose own reply is not in the transcript yet is told to resend unchanged, never that its rep
- [2026-11-06 21:59] (status) todo → superseded (by KIT-T872)
- [2026-11-06 22:00] (comment) @kit-agent: Same fault as KIT-T872 (fix a9382a4): the call's reply was not in the transcript at hook time, or held only thinking. See KIT-T872 Notes.
