---
id: KIT-T918
title: dispatch-guard handoff-before-replace (KIT-D116) blocks a READ-ONLY Plan dispatch as a replacement: groovegrid session 09e4451c, 2026-11-09,
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T21:22:05Z
updated: 2026-11-09T21:25:05Z
---

## Description
dispatch-guard handoff-before-replace (KIT-D116) blocks a READ-ONLY Plan dispatch as a replacement: groovegrid session 09e4451c, 2026-11-09, Agent call subagent_type Plan, model opus, prompt tagged [job: plan] and [read-only: design only], brief names GG-T158 only as reading material. Block text: this dispatch replaces an agent past the context ceiling that has not written its handoff; a34496fdbcb978537 (claude-kit:implementer) on GG-T158: no Handoff block in the ticket Notes. Expected: a read-only agent type (Plan, Explore, analyst, researcher) or a [read-only:] tagged dispatch replaces no writer and passes; the rule applies to a writer dispatch taking over the ticket. Also check: a34496fd is a retired GG-T158 writer from an earlier session that cannot be shown resumable, so the orient or the block should say whether SendMessage can still reach it. Related: KIT-T715 (old agent read-only), KIT-T818 (every ticket ever touched).

Checked as possible duplicates and judged different work (--not-dup): KIT-T715, KIT-T748, KIT-T818

kit-bug-shape: cap:bug:dispatch-guard-handoff-before-replace-kit-d116-b
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 21:22] (created) bug — dispatch-guard handoff-before-replace (KIT-D116) blocks a READ-ONLY Plan dispatch as a replacement: groovegrid session 09e4451c, 2026-11-09,
- [2026-11-09 21:24] (landed) 90501e8 dispatch-guard: handoff-before-replace skips a read-only dispatch (a read-only agent type or a [read-only: reason] tag r
- [2026-11-09 21:24] (comment) @claude: Fixed in hooks/dispatch-guard.mjs handoffCheck: skips a dispatch that owns no ticket work (reuses dispatch-readonly.mjs  (full comment #1 in ## Notes)
### comment #1 [2026-11-09 21:24] @claude
Fixed in hooks/dispatch-guard.mjs handoffCheck: skips a dispatch that owns no ticket work (reuses dispatch-readonly.mjs ownsWork + declaredReadOnly: read-only type or [read-only:] tag passes; patch-worker and writers still need the Handoff). hooks/agent-context.test.mjs 40 passed (3 new; 2 fail without the fix). KIT-T818 did not cover this. Publish pending: another session's publish (pid 34232, started 21:22:44Z, before this commit) held publish.lock; run npm run publish:runtime after it ends.
- [2026-11-09 21:25] (status) todo → review
