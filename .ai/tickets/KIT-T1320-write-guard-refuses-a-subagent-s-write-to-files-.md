---
id: KIT-T1320
title: write guard refuses a subagent's Write to files its OWN 'builds --run' compiles: the run is attributed to 'session 4100d9bf' with no agent i
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-16T20:54:20Z
updated: 2026-11-16T20:54:20Z
---

## Description
write guard refuses a subagent's Write to files its OWN 'builds --run' compiles: the run is attributed to 'session 4100d9bf' with no agent id (build pid 39356, cargo test -p rg-graphics --test sky_volume), the refusal says 'another writer started it'; builds --run from a subagent should carry the agent id so its own builds never hold its own edits (KIT-T1114)

kit-bug-shape: cap:bug:write-guard-refuses-a-subagent-s-write-to-files-:09eb8e22
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a builds --run from a subagent carries its writer; the agent's own edits pass its own build, another agent's still refuses

## Plan
1.

## Notes
Root cause: hooks/lib/build-wrap.mjs exported CLAUDE_KIT_BUILD_WRITER only for cargo commands and builds --wait; a builds --run was shimmed by nothing, so the run record and the build hold carried no writer and the guard saw another writer. Fix: --run joins --wait (BUILDS_WRITER_CALL); the agent id comes from the PreToolUse payload (writerId(session_id, subagentId)). Tests: node --test hooks/build-wrap.test.mjs 7 passed (new KIT-T1320 test failed first); hooks/write-batch.test.mjs, hooks/build-write-hold.test.mjs, scripts/broker/detached-run.test.mjs 6 passed.

## History
- [2026-11-16 20:54] (created) bug — write guard refuses a subagent's Write to files its OWN 'builds --run' compiles: the run is attributed to 'session 4100d9bf' with no agent i
- [2026-11-16 21:22] (comment) criterion added: a builds --run from a subagent carries its writer; the agent's own edits pass its own build, another agent's still refuses
- [2026-11-16 21:22] (comment) ticked: a builds --run from a subagent carries its writer; the agent's own edits pass its own build, another agent's still refuses
