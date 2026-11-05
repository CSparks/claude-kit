---
id: KIT-T856
title: question-brief hook (KIT-D129/T846) reports 'this reply's prose has 0' on AskUserQuestion even when a 200+ word brief with decision, 3 evide
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-04T19:33:09Z
updated: 2026-11-05T01:31:01Z
---

## Description
question-brief hook (KIT-D129/T846) reports 'this reply's prose has 0' on AskUserQuestion even when a 200+ word brief with decision, 3 evidence sources (file:line), named options, recommendation and not-asked precedes the call in the same assistant turn (groovegrid 2026-11-04, three attempts). Hook appears not to read the preceding prose block.

kit-bug-shape: cap:bug:question-brief-hook-kit-d129-t846-reports-this-r
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] diagnosed: groovegrid transcript bfad152d entries 1270-1296 hold only a thinking block and the tool_use for each of the three calls, no text block, so 0 words was true; the hook reads the transcript correctly
- [x] a reply with no text block gets a block message saying thinking and the call are not prose; question-brief-gate 31 passed incl. thinking-only blocked, thinking+text passes

## Plan
1.

## History
- [2026-11-04 19:33] (created) bug — question-brief hook (KIT-D129/T846) reports 'this reply's prose has 0' on AskUserQuestion even when a 200+ word brief with decision, 3 evide
- [2026-11-05 01:30] (comment) criterion added: diagnosed: groovegrid transcript bfad152d entries 1270-1296 hold only a thinking block and the tool_use for each of the three calls, no text block, so 0 words was true; the hook reads the transcript correctly
- [2026-11-05 01:30] (comment) criterion added: a reply with no text block gets a block message saying thinking and the call are not prose; question-brief-gate 31 passed incl. thinking-only blocked, thinking+text passes
- [2026-11-05 01:30] (comment) ticked: diagnosed: groovegrid transcript bfad152d entries 1270-1296 hold only a thinking block and the tool_use for each of the three calls, no text block, so 0 words was true; the hook reads the transcript correctly
- [2026-11-05 01:30] (comment) ticked: a reply with no text block gets a block message saying thinking and the call are not prose; question-brief-gate 31 passed incl. thinking-only blocked, thinking+text passes
- [2026-11-05 01:31] (status) todo → review
