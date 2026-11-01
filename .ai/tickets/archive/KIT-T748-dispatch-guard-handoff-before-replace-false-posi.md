---
id: KIT-T748
title: dispatch-guard handoff-before-replace false positive: blocks replacing past-ceiling agent adbb68fdaa83e0807 although all nine tickets (KIT-T
type: bug
status: done
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T01:00:30Z
updated: 2026-10-31T01:18:20Z
fixed_commit: f4f6387
---

## Description
dispatch-guard handoff-before-replace false positive: blocks replacing past-ceiling agent adbb68fdaa83e0807 although all nine tickets (KIT-T645 T649 T625 T620 T729 T719 T716 T718 T721) carry a '### Handoff adbb68fdaa83e0807' block with Jobs:/State:/Next:/Files: lines in Notes, written via t notes; blocked twice in the infra session 2026-10-31

kit-bug-shape: cap:bug:dispatch-guard-handoff-before-replace-false-posi
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed with KIT-T715 in f4f6387: a ticket's Handoff is now read from the store that holds the ticket (root first, then the registered project whose id key prefixes it), so a dispatch from a session whose root is not the store of the cited KIT tickets no longer reports a handoff missing that sits in Notes. The roster of D:/dev/claude-kit holds no row for adbb68fdaa83e0807, so the original block came from another root; the lookup was root-only. Evidence: hooks/agent-context.test.mjs 32 passed.

## History
- [2026-10-31 01:00] (created) bug — dispatch-guard handoff-before-replace false positive: blocks replacing past-ceiling agent adbb68fdaa83e0807 although all nine tickets (KIT-T
- [2026-10-31 01:00] (comment) seen again in claude-kit: dispatch-guard handoff-before-replace false positive: blocks replacing past-ceiling agent adbb68fdaa83e0807 although all nine tickets (KIT-T645 T649 T625 T620 T729 T719 T716 T718 T721) carry a Handoff adbb68fdaa83e0807 block with Jobs/State/Next/Files lines in Notes, written via t notes; blocked twi
- [2026-10-31 01:00] (asked again) 2026-10-31 — cap:bug:dispatch-guard-handoff-before-replace-false-posi
- [2026-10-31 01:13] (landed) f4f6387 handoff-before-replace: a read-only agent and an agent working in another checkout own no ticket here, and a ticket's Ha
- [2026-10-31 01:18] (status) todo → done
