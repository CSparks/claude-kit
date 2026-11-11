---
id: KIT-T961
title: commit-gate (KIT-T407) misfires on a submodule pin the session itself moved: 'git checkout <sha>' inside rapid-game/ then 'git add rapid-gam
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:29:14Z
updated: 2026-11-10T18:29:14Z
---

## Description
commit-gate (KIT-T407) misfires on a submodule pin the session itself moved: 'git checkout <sha>' inside rapid-game/ then 'git add rapid-game' is reported as 'not written by this session' because only Edit/Write paths count as session-written. The pin move is a documented session action (KIT-D141 pull-and-pin). Expected: a gitlink changed by a Bash git command in this session counts as own. Seen 2026-11-10 gridiron-blitz, commit for GB-T218.

kit-bug-shape: cap:bug:commit-gate-kit-t407-misfires-on-a-submodule-pin
first seen in gridiron-blitz. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:29] (created) bug — commit-gate (KIT-T407) misfires on a submodule pin the session itself moved: 'git checkout <sha>' inside rapid-game/ then 'git add rapid-gam
- [2026-11-10 18:29] (comment) @claude: 2026-11-10: fix dispatch held. dispatch-guard (KIT-D155) refused the writer: groovegrid session da28715f has uncommitted (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:29] @claude
2026-11-10: fix dispatch held. dispatch-guard (KIT-D155) refused the writer: groovegrid session da28715f has uncommitted changes to hooks/lib/tool-writes.mjs (KIT-T938 work), the file this fix most likely extends. Re-dispatch claude-kit:implementer [job: fix] after that session commits. Workaround used once: [commit-foreign] token in the GB-T218 commit.
