---
id: KIT-T854
title: question-brief-gate (KIT-D129/T846) blocks a questionnaire whose preceding prose names every option label verbatim, with options, recommenda
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T846]
files: []
supersedes:
superseded_by:
created: 2026-11-03T17:31:52Z
updated: 2026-11-03T17:51:21Z
---

## Description
question-brief-gate (KIT-D129/T846) blocks a questionnaire whose preceding prose names every option label verbatim, with options, recommendation and not-asked sections; it reported 'not named' for labels present in the text 4 times in a row (stiletto 2026-11-03, radar symbology questionnaire). Likely reads a stale or earlier transcript slice, or fails to see text in the same assistant turn as a prior blocked call. Also decision-gate (KIT-T744) fires on unrelated decisions (copper colour, camp vehicle icons, deleted 2D build) for a radar question.

kit-bug-shape: cap:bug:question-brief-gate-kit-d129-t846-blocks-a-quest
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief

## Plan
1.

## Notes
Same fault as the report 'this reply's prose has 13 words' (coordinator, 2026-11-03): the PreToolUse hook ran before the transcript writer had flushed the reply's text block, so turnText read the previous reply's short text. The transcript is ordered (one line per content block), so once the call's own tool_use entry is present every earlier block is. hooks/lib/turn-text.mjs turnTextForCall(file, tool_use_id) polls up to 3 s for that entry, then reads; a payload without tool_use_id reads at once. Test: a brief appended 700 ms after the gate starts passes; a thin one appended late is still blocked. Not fixed here: decision-gate (KIT-T744) firing on unrelated decisions (second half of this ticket's description).

## History
- [2026-11-03 17:31] (created) bug — question-brief-gate (KIT-D129/T846) blocks a questionnaire whose preceding prose names every option label verbatim, with options, recommenda
- [2026-11-03 17:48] (status) todo → doing
- [2026-11-03 17:51] (comment) criterion added: question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief
- [2026-11-03 17:51] (comment) ticked: question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief
- [2026-11-03 17:51] (status) doing → review
