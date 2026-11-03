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
updated: 2026-11-03T17:56:38Z
---

## Description
question-brief-gate (KIT-D129/T846) blocks a questionnaire whose preceding prose names every option label verbatim, with options, recommendation and not-asked sections; it reported 'not named' for labels present in the text 4 times in a row (stiletto 2026-11-03, radar symbology questionnaire). Likely reads a stale or earlier transcript slice, or fails to see text in the same assistant turn as a prior blocked call. Also decision-gate (KIT-T744) fires on unrelated decisions (copper colour, camp vehicle icons, deleted 2D build) for a radar question.

kit-bug-shape: cap:bug:question-brief-gate-kit-d129-t846-blocks-a-quest
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief
- [x] a plainly labelled decision line ('- decision: what is being decided is ..., needed now because ...', 'Decision: <statement>', '**Decision:** ...') meets the brief's decision part; 'decided' counts as a decision word and 'because'/'needed' as a why-now cue; question-brief-gate 28 passed

## Plan
1.

## Notes
Same fault as the report 'this reply's prose has 13 words' (coordinator, 2026-11-03): the PreToolUse hook ran before the transcript writer had flushed the reply's text block, so turnText read the previous reply's short text. The transcript is ordered (one line per content block), so once the call's own tool_use entry is present every earlier block is. hooks/lib/turn-text.mjs turnTextForCall(file, tool_use_id) polls up to 3 s for that entry, then reads; a payload without tool_use_id reads at once. Test: a brief appended 700 ms after the gate starts passes; a thin one appended late is still blocked. Not fixed here: decision-gate (KIT-T744) firing on unrelated decisions (second half of this ticket's description).
Second cause (coordinator report, MIDI/Ableton brief): the decision part needed the word decision|deciding|decide|choosing|the choice AND a why-now phrase from a short list. 'decided' matched none (decide only), and 'Decision: Ableton shows ...' had no listed why-now phrase. Now a line labelled Decision: (bullet, bold or plain, 6+ words) is the decision statement on its own; the loose rule also takes decided/decides and needed/because. Control: prose with no decision statement is still blocked.

## History
- [2026-11-03 17:31] (created) bug — question-brief-gate (KIT-D129/T846) blocks a questionnaire whose preceding prose names every option label verbatim, with options, recommenda
- [2026-11-03 17:48] (status) todo → doing
- [2026-11-03 17:51] (comment) criterion added: question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief
- [2026-11-03 17:51] (comment) ticked: question-brief-gate counts the prose of the reply the call sits in: it waits (up to 3 s) for the call's own tool_use entry in the transcript before reading; question-brief-gate 24 passed incl. a late-flushed brief
- [2026-11-03 17:51] (status) doing → review
- [2026-11-03 17:51] (landed) fa5f7e7 question-brief-gate: read the transcript once it holds the call's own tool_use entry, so the reply's text block is count
- [2026-11-03 17:56] (comment) criterion added: a plainly labelled decision line ('- decision: what is being decided is ..., needed now because ...', 'Decision: <statement>', '**Decision:** ...') meets the brief's decision part; 'decided' counts as a decision word and 'because'/'needed' as a why-now cue; question-brief-gate 28 passed
- [2026-11-03 17:56] (comment) ticked: a plainly labelled decision line ('- decision: what is being decided is ..., needed now because ...', 'Decision: <statement>', '**Decision:** ...') meets the brief's decision part; 'decided' counts as a decision word and 'because'/'needed' as a why-now cue; question-brief-gate 28 passed
- [2026-11-03 17:56] (status) review → review
