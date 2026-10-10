---
id: KIT-T405
title: Process failure (2026-10-09, Chris: 'BOTH of these things have been asked for NUMEROUS times'): KIT-T339 (model-capability refresh, asked 20
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T21:08:01Z
updated: 2026-10-10T00:25:31Z
---

## Description
Process failure (2026-10-09, Chris: 'BOTH of these things have been asked for NUMEROUS times'): KIT-T339 (model-capability refresh, asked 2026-10-01) sat at medium for 8 days and KIT-T403's visibility gap was raised before too. ROOT CAUSE: a repeat ask from the maintainer has no escalation - triage/cap dedup finds the existing ticket and leaves its priority alone, so 'asked again' never bumps it. FIX: cap/triage on a duplicate match bumps the matched ticket one priority step per repeat, stamps 'asked Nx' on it, and orient lists repeat-asked open tickets under DISPATCH NOW

kit-bug-shape: cap:bug:process-failure-2026-10-09-chris-both-of-these-t
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 21:08] (created) bug — Process failure (2026-10-09, Chris: 'BOTH of these things have been asked for NUMEROUS times'): KIT-T339 (model-capability refresh, asked 20
- [2026-10-10 00:15] (status) todo → doing
- [2026-10-10 00:25] (comment) @chris: 2026-10-09: scripts/asked-again.mjs (bumpAsked, askedAgainOpen); bump wired to the exact kit-bug shape match from cap (r (full comment #1 in ## Notes)
### comment #1 [2026-10-10 00:25] @chris
2026-10-09: scripts/asked-again.mjs (bumpAsked, askedAgainOpen); bump wired to the exact kit-bug shape match from cap (repeatAsk) and to new 't asked <id>'; orient lists asked>=2 under DISPATCH NOW; scripts/asked-again.test.mjs 7 passed; npm test 87/88 (server.test.mjs express missing, pre-existing)
- [2026-10-10 00:25] (status) doing → review
