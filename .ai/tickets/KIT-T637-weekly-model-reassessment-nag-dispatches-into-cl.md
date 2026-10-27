---
id: KIT-T637
title: weekly model reassessment nag dispatches into ~/.claude/claude-kit-runtime/<sha>, which is not a git repo: the agent cannot commit/push, and
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-26T21:53:28Z
updated: 2026-10-26T21:53:28Z
---

## Description
weekly model reassessment nag dispatches into ~/.claude/claude-kit-runtime/<sha>, which is not a git repo: the agent cannot commit/push, and model-refresh.mjs reads D:/dev/claude-kit's evidence date so the gate never clears. 2026-10-26 run wrote research/models-capability-2026-10-26.md + 12 re-dated config.yml rows in the runtime tree only. Root cause: the SessionStart nag names the runtime copy instead of the source checkout.

kit-bug-shape: cap:bug:weekly-model-reassessment-nag-dispatches-into-cl
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-26 21:53] (created) bug — weekly model reassessment nag dispatches into ~/.claude/claude-kit-runtime/<sha>, which is not a git repo: the agent cannot commit/push, and
