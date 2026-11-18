---
id: KIT-T1379
title: PROCESS FAILURE (4th repeat, road-generator main thread, 2026-11-18): the coordinator relays a builder hand-back that landed commits but nam
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T15:59:09Z
updated: 2026-11-18T16:05:01Z
---

## Description
PROCESS FAILURE (4th repeat, road-generator main thread, 2026-11-18): the coordinator relays a builder hand-back that landed commits but names no sha in its reply, so the Stop landing-alert blocks. Root cause: shas of commits made by a subagent never reach the coordinator's context at hand-back time (the hand-back text carries branch-era names, not shas), and the coordinator's discipline did not hold across four turns. Prevention wanted: when a subagent hand-back or task notification arrives, the UserPromptSubmit/notification hook injects 'LANDED SINCE LAST REPLY: <repo> <sha> <subject>' for each new unpushed commit in the project and its framework submodule, so the sha is in front of the coordinator when it writes the reply.

kit-bug-shape: cap:bug:process-failure-4th-repeat-road-generator-main-t:7b26ceb2
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a prompt, task notification, hand-back or message injects LANDED SINCE LAST REPLY with <repo> <sha> <subject> for commits landed this turn or unpushed in the project and its submodules, each once per session, at most eight named then a count; the Stop gate accepts a 7-character prefix (hooks/landed-notice.test.mjs)

## Plan
1.

## Notes
Built: hooks/landed-notice.mjs on UserPromptSubmit (which fires for task notifications too: in road-generator session 4100d9bf, 32 of its 133 UserPromptSubmit runs followed a task-notification) and on PostToolUse(Task|Agent|SendMessage), with hooks/lib/landed-since-reply.mjs.

- It injects "LANDED SINCE LAST REPLY: name each sha in your reply ..." and one line per commit, `<repo> <8-char sha> <subject, 80 chars>`, for the project and each checked-out submodule: the commits landed this turn (the same landedThisTurn the Stop landing alert uses) and the commits not pushed, minus any an earlier assistant reply already named by sha.
- Each commit is listed once per session (state in the turn-state slot landed-notice-<session>, last 200 shas). At most eight commits are named, the rest collapse to "+N more (t receipt lists them)", so the block is at most ten lines.
- A task notification or a PostToolUse continues the turn (turn start read from the transcript as the alert does); a real prompt starts a new turn, so only unpushed commits count then.
- UserPromptSubmit prints plain text (context); PostToolUse returns additionalContext.
- The Stop gate already names the shas it wants in its MISSING line and already accepts any 7-character prefix (announced-landings.mjs MIN_SHA_CHARS = 7); a test pins that a 7-character prefix counts and 6 does not.

Plugin 0.1.60 (hook wiring changed). A session takes the new hooks at its next start.

Tests: hooks/landed-notice.test.mjs all pass (7); land-alert exit 0; gate-wiring 17; plugin-compat 163; plugin-drift 14; handback 51.

## History
- [2026-11-18 15:59] (created) bug — PROCESS FAILURE (4th repeat, road-generator main thread, 2026-11-18): the coordinator relays a builder hand-back that landed commits but nam
- [2026-11-18 16:05] (status) todo → doing
- [2026-11-18 16:05] (comment) criterion added: a prompt, task notification, hand-back or message injects LANDED SINCE LAST REPLY with <repo> <sha> <subject> for commits landed this turn or unpushed in the project and its submodules, each once per session, at most eight named then a count; the Stop gate accepts a 7-character prefix (hooks/landed-notice.test.mjs)
- [2026-11-18 16:05] (comment) ticked: a prompt, task notification, hand-back or message injects LANDED SINCE LAST REPLY with <repo> <sha> <subject> for commits landed this turn or unpushed in the project and its submodules, each once per session, at most eight named then a count; the Stop gate accepts a 7-character prefix (hooks/landed-notice.test.mjs)
