---
id: KIT-T662
title: Weekly model-reassessment orient brief points the agent at claude-kit-runtime/<sha>, an export copy with no .git: the agent writes research
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T05:46:30Z
updated: 2026-10-28T05:46:30Z
---

## Description
Weekly model-reassessment orient brief points the agent at claude-kit-runtime/<sha>, an export copy with no .git: the agent writes research + redates config there and cannot commit; work is lost on the next export. Root cause: the brief names the runtime dir instead of the source checkout D:/dev/claude-kit. Seen 2026-10-28 (landed by hand as c503d05).

kit-bug-shape: cap:bug:weekly-model-reassessment-orient-brief-points-th
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 05:46] (created) bug — Weekly model-reassessment orient brief points the agent at claude-kit-runtime/<sha>, an export copy with no .git: the agent writes research
