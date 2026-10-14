---
id: KIT-T311
title: q gap: a grep followed an empty q fts for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T453
superseded_by:
created: 2026-10-03T18:15:09Z
updated: 2026-10-13T19:49:59Z
---

## Description
q: q fts SELF-COMMENTING CODE 2>&1  then  grep: SELF-COMMENTING

kit-bug-shape: q-gap:grep-after-empty-q:fts
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-03 18:15] (created) bug — q gap: a grep followed an empty q fts for the same terms
- [2026-10-06 03:55] (comment) seen again in stiletto-2349: q: q fts "parallel agents throughput qwen" 2>&1 then grep: parallel|np |slots|-np|agents
- [2026-10-06 18:09] (comment) seen again in stiletto-2349: q: q fts perf tuning lever 2>&1 then grep: perf
- [2026-10-07 03:15] (comment) seen again in stiletto-2349: q: q fts "t870-bench-trace" then grep: trace result
- [2026-10-07 20:13] (comment) seen again in stiletto-2349: q: q fts wheel_materials rg_tool_asset_editor 2>&1 then grep: rg_tool_asset_editor
- [2026-10-13 19:49] (comment) @sonnet55: Fixed c6cd74d. Cause: fts matched every term as an AND of phrases over work items only, so long agent queries and phrase (full comment #1 in ## Notes)
### comment #1 [2026-10-13 19:49] @sonnet55
Fixed c6cd74d. Cause: fts matched every term as an AND of phrases over work items only, so long agent queries and phrases that live in docs/config returned nothing. Now an empty strict match retries with any term (--any, flagged on stderr) and adds doc/config lines holding every term. Tests: scripts/q-fts.test.mjs (6, logged terms 'parallel agents throughput qwen', 'perf tuning lever'), npm test exit 0.
- [2026-10-13 19:49] (status) todo → review
