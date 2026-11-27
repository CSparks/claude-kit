---
id: KIT-T1611
title: process failure (road-generator main thread 2026-11-27): the coordinator answered a status question ('Where do things sit right now with roa
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-27T19:18:41Z
updated: 2026-11-27T19:18:41Z
---

## Description
process failure (road-generator main thread 2026-11-27): the coordinator answered a status question ('Where do things sit right now with roads?') and relayed agent reports, listing open known faults, then ended turns with no agent working them; the maintainer had to say 'You have known faults still open and you stopped fucking working' (RDG-D194). Root cause: nothing stops a closing reply that names open faults while no agent is live and no questionnaire is pending; the bill-of-work rule is read as permission to idle. Prevention: a Stop gate that blocks once when the closing reply lists open faults or red tests and the roster has no live agent, asking for a dispatch; plus a standing-rules line for RDG-D194.

kit-bug-shape: cap:bug:process-failure-road-generator-main-thread-2026-:2563f4c1
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] A closing reply naming open faults, with no live roster agent, no SendMessage and no questionnaire in the turn, blocks the stop once (hooks/open-fault-dispatch.test.mjs)

## Plan
1.

## Notes
Built: Stop gate open-fault-dispatch (hooks/open-fault-dispatch.mjs, scanner hooks/lib/open-fault-report.mjs, liveness hooks/lib/live-roster.mjs shared with dispatch-guard), wired in hooks.json, README rows, a line in user-config/CLAUDE.global.md; test hooks/open-fault-dispatch.test.mjs 36 passed. NOT DONE: the standing-rules line for RDG-D194 ('While known faults are open, keep an agent on them; a status answer or a relayed report never ends the turn idle.', 116 chars with its bullet) does not fit: the block is 3655 of its 3700-character cap (BLOCK_MAX_CHARS, hooks/rule-block.test.mjs), 45 left. The cap was not raised; the maintainer has not ruled on it (same block as KIT-T1608). The rule's text sits in CLAUDE.global.md beside the red-test-dispatch line instead.

## History
- [2026-11-27 19:18] (created) bug — process failure (road-generator main thread 2026-11-27): the coordinator answered a status question ('Where do things sit right now with roa
- [2026-11-27 19:29] (comment) criterion added: A closing reply naming open faults, with no live roster agent, no SendMessage and no questionnaire in the turn, blocks the stop once (hooks/open-fault-dispatch.test.mjs)
