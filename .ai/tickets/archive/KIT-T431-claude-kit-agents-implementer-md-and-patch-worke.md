---
id: KIT-T431
title: claude-kit agents/implementer.md (and patch-worker, perf-tuner) exist in the kit but are not loaded as claude-kit:* agent types in this sess
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-12T20:38:17Z
updated: 2026-10-27T22:27:25Z
---

## Description
claude-kit agents/implementer.md (and patch-worker, perf-tuner) exist in the kit but are not loaded as claude-kit:* agent types in this session: Agent tool says 'claude-kit:implementer not found' (2026-10-12, stiletto-2349). Plugin agent registration is missing them.

kit-bug-shape: cap:bug:claude-kit-agents-implementer-md-and-patch-worke
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] cause found: session predates the agents (fresh sessions register all 14)
- [x] dispatch-guard warns on an agent type newer than the session (hooks/dispatch-agent-loaded.mjs, tests in hooks/dispatch-guard.test.mjs)
- [x] registration lint: scripts/plugin-compat.test.mjs (tracked agent is registered, 110+ checks)

## Notes
Root cause 2026-10-12: not a manifest, frontmatter or cache defect. The manifest lists all 14 agents, `claude plugin validate` finds no agent frontmatter errors, and fresh sessions register all 14 (`claude -p` from stiletto-2349 and `--plugin-dir` on a copy both list implementer, patch-worker and perf-tuner). The orchestrating session started 2026-10-02 12:04, before agents/implementer.md (2026-10-05), patch-worker and perf-tuner were registered. A session loads plugin agent types once at start, so the three stayed `not found` for its whole life. Fix: dispatch-guard check `agent-registry-stale` warns when a `<plugin>:<agent>` type was added to the kit after the session's first transcript timestamp, naming /reload-plugins or a restart. The registration lint already existed (scripts/plugin-compat.test.mjs: tracked agent registered, frontmatter valid, no model line).

## Plan
1.

## History
- [2026-10-12 20:38] (created) bug — claude-kit agents/implementer.md (and patch-worker, perf-tuner) exist in the kit but are not loaded as claude-kit:* agent types in this sess
- [2026-10-12 21:20] (status) todo → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)
