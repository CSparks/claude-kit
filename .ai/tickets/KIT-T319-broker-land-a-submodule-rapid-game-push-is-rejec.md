---
id: KIT-T319
title: broker land: a submodule (rapid-game) push is rejected when origin/main moved (someone pushed 7fbd4d0 from another checkout); the job ends '
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T17:55:38Z
updated: 2026-10-04T18:31:53Z
---

## Description
broker land: a submodule (rapid-game) push is rejected when origin/main moved (someone pushed 7fbd4d0 from another checkout); the job ends 'failed at land' with the commit stranded locally (884945e, ST-T823) and no superproject pin. land.mjs pushes with no fetch/rebase. Fix: before push, fetch and rebase the landed commit onto the remote main (re-test if the rebase touched the patch's paths, else push), and pin after; or refuse to start a job while the repo is behind its remote. Job j-muu48eej-5n6ygk.

kit-bug-shape: cap:bug:broker-land-a-submodule-rapid-game-push-is-rejec
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] land fetches and rebases onto a moved origin before pushing (job commit and superproject pin); a conflict reports conflict and leaves the tree untouched

## Plan
1.

## History
- [2026-10-04 17:55] (created) bug — broker land: a submodule (rapid-game) push is rejected when origin/main moved (someone pushed 7fbd4d0 from another checkout); the job ends '
- [2026-10-04 17:55] (comment) seen again in stiletto-2349: broker land: a submodule (rapid-game) push is rejected when origin/main moved (someone pushed 7fbd4d0 from another checkout); the job ends 'failed at land' with the commit stranded locally (884945e, ST-T823) and no superproject pin. land.mjs pushes with no fetch/rebase. Fix: before push, fetch and r
- [2026-10-04 18:31] (comment) criterion added: land fetches and rebases onto a moved origin before pushing (job commit and superproject pin); a conflict reports conflict and leaves the tree untouched
- [2026-10-04 18:31] (comment) ticked: land fetches and rebases onto a moved origin before pushing (job commit and superproject pin); a conflict reports conflict and leaves the tree untouched
- [2026-10-04 18:31] (comment) @sonnet55: scripts/broker/sync-push.mjs: fetch; if behind, refuse when incoming files overlap uncommitted edits, else git rebase -- (full comment #1 in ## Notes)
### comment #1 [2026-10-04 18:31] @sonnet55
scripts/broker/sync-push.mjs: fetch; if behind, refuse when incoming files overlap uncommitted edits, else git rebase --autostash onto the remote tip; conflict -> rebase --abort, local job commit dropped (reset --mixed to the pre-land HEAD), caller restores the journal, result status conflict naming the files. Re-verify choice: after a rebase that pulled in anything other than .md/.txt the job's commands re-run on the rebased tree (the broker has no dependency graph, and an incoming source change can break dependants); failures already known as foreign are tolerated; a failing re-run leaves the rebased commit local and unpushed. Superproject pin pushes through the same path. Tests: scripts/broker/land-sync.test.mjs (6), broker suite 98 passed; mutation (never fetch/rebase) fails 5.
- [2026-10-04 18:31] (status) todo → review
