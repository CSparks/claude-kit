---
id: KIT-T1603
title: q: search a git repo that has no .ai store. In D:\dev\fleet-desktop (git repo, no .ai) q resolves to the unbounded catch-all store and 'q co
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-26T07:03:22Z
updated: 2026-11-26T07:11:05Z
---

## Description
q: search a git repo that has no .ai store. In D:\dev\fleet-desktop (git repo, no .ai) q resolves to the unbounded catch-all store and 'q code' returns no results, so agents fall back to the Grep tool. q code/sym/file should index the cwd's git repo even when it has no .ai.

kit-bug-shape: cap:feature:q-search-a-git-repo-that-has-no-ai-store-in-d-de:857cbdc9
first seen in fleet-desktop. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: scripts/code-root.mjs codeRoot(cwd, explicitRoot): an explicit --root wins, else the checkout of the nearest store; when the nearest store is only the unbounded catch-all, the cwd's git repo is indexed; outside every repo the catch-all stands. q-lib.mjs (in-process) and q-server.mjs (resident server) both call it. Work-store verbs (fts, show, open) keep resolving to the unbounded store. Tests: new scripts/code-root.test.mjs 5 passed 1 failed without the q edits (the end-to-end q code), 6 passed 0 failed with them; unbounded 32/0; q-server 8/0.

## History
- [2026-11-26 07:03] (created) feature — q: search a git repo that has no .ai store. In D:\dev\fleet-desktop (git repo, no .ai) q resolves to the unbounded catch-all store and 'q co
- [2026-11-26 07:11] (status) todo → review
