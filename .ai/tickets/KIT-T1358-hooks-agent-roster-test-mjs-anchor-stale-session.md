---
id: KIT-T1358
title: hooks/agent-roster.test.mjs: 'anchor: stale SESSION + work-this-turn nags once (exit 2)' fails at HEAD c00dd351 and b900b4a1 (47 passed, 1 f
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T00:22:42Z
updated: 2026-11-18T00:30:57Z
fixed_commit: 3ac8a717
---

## Description
hooks/agent-roster.test.mjs: 'anchor: stale SESSION + work-this-turn nags once (exit 2)' fails at HEAD c00dd351 and b900b4a1 (47 passed, 1 failed); flush.mjs Stop anchor ratchet

kit-bug-shape: cap:bug:hooks-agent-roster-test-mjs-anchor-stale-session:6c19aeb0
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] hooks/agent-roster.test.mjs section 4 (a) and (b) use a decision write as this turn's work, so (b) nags and (a) is silent only because the anchor is fresh; 48 passed, 0 failed

## Plan
1.

## Notes
Root cause: the test is stale, the hook is right. KIT-T1150 (a86f0fe9, 2026-11-13) made the Stop flush write a landing note for each commit of the turn before it judges the anchor, and a noted commit no longer counts as unflushed work; ticket edits never counted (WORK_STORES = decisions, notes, questions, KIT-D126). Case (b) offered only a commit (auto-noted) and a ticket edit (bookkeeping), so the hook correctly stayed silent. a86f0fe9 updated hooks/flush.test.mjs (its 'control: a commit plus a decision edit with a stale anchor still nags' case) but not this duplicate in agent-roster.test.mjs. Fix: (b) writes a decision this turn, the work the rule still asks a real t session for; (a) uses the same work, so its silence now proves the fresh-anchor path instead of passing for lack of work. The check is unchanged and still asserts exit 2 with the 'resume anchor' text.

## History
- [2026-11-18 00:22] (created) bug — hooks/agent-roster.test.mjs: 'anchor: stale SESSION + work-this-turn nags once (exit 2)' fails at HEAD c00dd351 and b900b4a1 (47 passed, 1 f
- [2026-11-18 00:30] (status) todo → doing
- [2026-11-18 00:30] (comment) criterion added: hooks/agent-roster.test.mjs section 4 (a) and (b) use a decision write as this turn's work, so (b) nags and (a) is silent only because the anchor is fresh; 48 passed, 0 failed
- [2026-11-18 00:30] (comment) ticked: agent-roster.test.mjs 48 passed; flush.test.mjs 52/52
- [2026-11-18 00:30] (landed) 3ac8a717 claims-release-gate refuses a subagent's command that runs a kit hook entry point (check-id hook-entry-run); the roster
- [2026-11-18 00:30] (status) doing → review
- [2026-11-18 00:30] (comment) runtime 3ac8a717 published
