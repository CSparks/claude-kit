---
id: KIT-T819
title: hooks/dispatch-guard.test.mjs is the slowest kit test file: 96 s alone and 163 s under the parallel suite (2026-11-01, runtime 90e49bb), nea
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T00:09:11Z
updated: 2026-11-02T00:14:25Z
---

## Description
hooks/dispatch-guard.test.mjs is the slowest kit test file: 96 s alone and 163 s under the parallel suite (2026-11-01, runtime 90e49bb), near the KIT-D104 five-minute ceiling and growing with every dispatch-guard check. Split it per check-id (one test file per dispatch-guard check, matching the per-check modules like dispatch-brief.mjs) and find what makes each case slow (process spawn per case, store fixtures rebuilt per case).

kit-bug-shape: cap:bug:hooks-dispatch-guard-test-mjs-is-the-slowest-kit
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-02 00:09] (created) bug — hooks/dispatch-guard.test.mjs is the slowest kit test file: 96 s alone and 163 s under the parallel suite (2026-11-01, runtime 90e49bb), nea
- [2026-11-02 00:14] (comment) @claude: Cause: each case spawns the hook (about 0.6s), and model-tag.mjs superprojects() ran git rev-parse --show-superproject-w (full comment #1 in ## Notes)
### comment #1 [2026-11-02 00:14] @claude
Cause: each case spawns the hook (about 0.6s), and model-tag.mjs superprojects() ran git rev-parse --show-superproject-working-tree on every pinnedModel/definitionJob/definitionTools call, 7 spawns per dispatch (about 400ms of 580ms). Fix: superprojects() memoized per root (hooks/model-tag.mjs); a hook spawn is now about 230ms. dispatch-guard.test.mjs split into dispatch-guard (ladder, stale table, no pins, registry-stale), dispatch-cold-worktree, dispatch-shared-tree, dispatch-foreign-tree, dispatch-holder, dispatch-job, dispatch-escalation, dispatch-brief over shared hooks/dispatch-guard-harness.mjs. Cases 197 before, 197 after (46+19+52+9+12+14+35+10). Times: before one file 96s alone (163s in the suite); after, run in parallel, slowest dispatch-shared-tree 16s, guard 8s, escalation 10s, others 4-8s. model-tag 70 passed, agent-context 37 passed.
- [2026-11-02 00:14] (status) todo → review
- [2026-11-02 00:14] (landed) 7cd325b dispatch-guard tests: one file per check, and the hook spawn drops from 580ms to 230ms by caching the superproject probe
