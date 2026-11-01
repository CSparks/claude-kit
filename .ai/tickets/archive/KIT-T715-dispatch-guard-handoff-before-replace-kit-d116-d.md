---
id: KIT-T715
title: dispatch-guard handoff-before-replace (KIT-D116) demands a Handoff block from a READ-ONLY analyst (a2165eb, report saved as DE-N011) and fro
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T21:32:28Z
updated: 2026-10-31T01:18:18Z
fixed_commit: f4f6387
---

## Description
dispatch-guard handoff-before-replace (KIT-D116) demands a Handoff block from a READ-ONLY analyst (a2165eb, report saved as DE-N011) and from a kit-tree agent whose brief merely mentioned project ticket ids (a9ce2b9). Read-only agents own no work and should be exempt; ticket ownership should come from what the agent submitted or edited, not ids named in its brief.

kit-bug-shape: cap:bug:dispatch-guard-handoff-before-replace-kit-d116-d
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in f4f6387: missingHandoffs skips read-only roster rows (readOnlyRow) and counts only tickets an agent owns, i.e. cited in its brief AND held by the store of the checkout it works in (row.targetRoot, else the dispatching root; hooks/lib/ticket-store.mjs). Evidence: hooks/agent-context.test.mjs 32 passed (read-only past-ceiling agent and other-checkout agent no longer block; a writer in this checkout with no handoff still blocks), successor-gate 12, orient 34.

## History
- [2026-10-29 21:32] (created) bug — dispatch-guard handoff-before-replace (KIT-D116) demands a Handoff block from a READ-ONLY analyst (a2165eb, report saved as DE-N011) and fro
- [2026-10-31 01:13] (landed) f4f6387 handoff-before-replace: a read-only agent and an agent working in another checkout own no ticket here, and a ticket's Ha
- [2026-10-31 01:18] (status) todo → done
