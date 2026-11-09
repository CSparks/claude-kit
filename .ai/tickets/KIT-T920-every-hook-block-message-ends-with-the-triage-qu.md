---
id: KIT-T920
title: Every hook block message ends with the triage question 'process failure or kit bug?' (process failure: name the prevention; kit bug: ticket
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T23:06:47Z
updated: 2026-11-09T23:29:56Z
---

## Description
Every hook block message ends with the triage question 'process failure or kit bug?' (process failure: name the prevention; kit bug: ticket and dispatch the fix agent now), and the base CLAUDE.md and every agent brief template carry it (Chris 2026-11-09: 'That is a question EVERY agent should ask anytime they encounter a hook block...'). Write the KIT decision (see groovegrid GG decision from 2026-11-09), the footer line in the shared gate-message code, the CLAUDE.md rule per KIT-D146, and a test that every gate's block text contains it.

kit-bug-shape: cap:feature:every-hook-block-message-ends-with-the-triage-qu
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 23:06] (created) feature — Every hook block message ends with the triage question 'process failure or kit bug?' (process failure: name the prevention; kit bug: ticket
- [2026-11-09 23:29] (status) todo → review
- [2026-11-09 23:30] (landed) f53b948 block triage as a global principle: KIT-D154 (every agent says "process failure or kit bug?" on any hook block); the lin
- [2026-11-09 23:49] (comment) @kit-agent: Plugin 0.1.35 bump needed for the agent-definition triage section and the tool-write-record hook wiring to reach sessions (plugin cache refresh).
