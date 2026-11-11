---
id: KIT-T924
title: Stop hook: detect decisions put to the maintainer as prose questions (e.g. 'Which behaviour do you want, and does X match?', 'Waiting on you
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T23:30:56Z
updated: 2026-11-09T23:30:56Z
---

## Description
Stop hook: detect decisions put to the maintainer as prose questions (e.g. 'Which behaviour do you want, and does X match?', 'Waiting on you: ...', 'want me to X?') in a final reply and require a questionnaire with the summary above it instead. Process failure 2026-11-09 (groovegrid): the orchestrator asked about a strum spread drag, the Track Lanes collapse and the chevron spot in prose; Chris: 'WHy aren't you using the fucking questionnaire?' KIT-D152 audits the summary of a questionnaire that was sent; nothing audits a decision that should have been one.

kit-bug-shape: cap:feature:stop-hook-detect-decisions-put-to-the-maintainer
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 23:30] (created) feature — Stop hook: detect decisions put to the maintainer as prose questions (e.g. 'Which behaviour do you want, and does X match?', 'Waiting on you
- [2026-11-09 23:34] (comment) @claude: Chris 2026-11-09, verbatim: 'I fucking said 10 times yesterday NOTHING IS FUCKING WAITING ON ME IF I DON'T GET A FUCKING (full comment #1 in ## Notes)
### comment #1 [2026-11-09 23:34] @claude
Chris 2026-11-09, verbatim: 'I fucking said 10 times yesterday NOTHING IS FUCKING WAITING ON ME IF I DON'T GET A FUCKING QUESTIONNIRE.' Rule: an open decision that is not in a questionnaire is not waiting on him and must not be listed as 'waiting on you' in prose.
