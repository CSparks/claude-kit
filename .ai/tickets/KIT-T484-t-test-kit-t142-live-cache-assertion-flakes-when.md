---
id: KIT-T484
title: t.test KIT-T142 live-cache assertion flakes when another session refreshes the claude-kit .cache/workflow.db during npm test (mtime changes, not the suite's write)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T18:48:01Z
updated: 2026-10-14T20:14:02Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 18:48] (created) bug — t.test KIT-T142 live-cache assertion flakes when another session refreshes the claude-kit .cache/workflow.db during npm test (mtime changes, not the suite's write)
- [2026-10-14 18:59] (comment) @claude: Same publish run family, two more load flakes (machine at ~55 % CPU with a cargo freeze build): broker/liveness.test.mjs (full comment #1 in ## Notes)
### comment #1 [2026-10-14 18:59] @claude
Same publish run family, two more load flakes (machine at ~55 % CPU with a cargo freeze build): broker/liveness.test.mjs 'two real daemons started together leave exactly one holding the lock' (2 !== 1) and broker/testonly.test.mjs fixture 'git push origin main' to a local bare repo died with 'send-pack: unexpected disconnect … Broken pipe'. Both pass alone right after (8/8).
- [2026-10-14 20:13] (comment) @claude: Fixed: the KIT-T142 guard no longer reads a changed live-cache mtime as a leak (other sessions refresh it); it fails onl (full comment #2 in ## Notes)
### comment #2 [2026-10-14 20:13] @claude
Fixed: the KIT-T142 guard no longer reads a changed live-cache mtime as a leak (other sessions refresh it); it fails only when the live KIT scope shrank, which is what the original leak did. t.test 109 passed.
- [2026-10-14 20:14] (status) todo → review
