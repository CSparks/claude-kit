---
id: KIT-T407
title: Process failure (kit 2026-10-09): the KIT-T339 writer committed another session's uncommitted kit work in 596d1fc via 'git add scripts' - sc
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-09T21:47:27Z
updated: 2026-10-10T00:14:42Z
---

## Description
Process failure (kit 2026-10-09): the KIT-T339 writer committed another session's uncommitted kit work in 596d1fc via 'git add scripts' - scripts/code-index-query.mjs, code-index.test.mjs, deck-config.mjs, devices.mjs, devices.test.mjs, q-lib.mjs, q-project.mjs, q-server.mjs, hooks/orient.test.mjs (the stiletto-2349-2a session's WIP, KIT-T397 deck deploy / devices). Pushed. ROOT CAUSE: two writers in one checkout - the dispatch guard checks the ROSTER for a second writer but not the TREE: a dirty kit tree with foreign edits was not a dispatch blocker; and the commit gate lets a directory-wide git add stage files the committing agent never touched. FIX: (1) dispatch-guard refuses a writer dispatch into a checkout whose git status shows modified tracked source not attributable to the roster; (2) the commit gate rejects a commit whose staged files include any path the session/agent did not Edit/Write this run (the Write/Edit hooks already see every path) unless [commit-foreign: reason]; (3) brief rule 'stop on foreign edits' becomes a hook, not a sentence

kit-bug-shape: cap:bug:process-failure-kit-2026-10-09-the-kit-t339-writ
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-09 21:47] (created) bug — Process failure (kit 2026-10-09): the KIT-T339 writer committed another session's uncommitted kit work in 596d1fc via 'git add scripts' - sc
- [2026-10-09 23:56] (status) todo → doing
- [2026-10-10 00:14] (comment) @chris: 2026-10-09: built per-session writes ledger (hooks/turn-writes.mjs), commit-gate foreign-path block + [commit-foreign:], (full comment #1 in ## Notes)
### comment #1 [2026-10-10 00:14] @chris
2026-10-09: built per-session writes ledger (hooks/turn-writes.mjs), commit-gate foreign-path block + [commit-foreign:], dispatch-guard foreign-tree-edits + [foreign-edits-ok:]; npm test 86/87 (server.test.mjs missing express, pre-existing); tests hooks/commit-gate.test.mjs 35 passed, hooks/dispatch-guard.test.mjs 118 passed
- [2026-10-10 00:14] (status) doing → review
