---
id: KIT-T416
title: Process failure 2026-10-10 (dirt-empire): filed 'native resolution by default' as a new framework ask; it was already built upstream (RG-T19
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T14:55:28Z
updated: 2026-10-10T14:55:28Z
---

## Description
Process failure 2026-10-10 (dirt-empire): filed 'native resolution by default' as a new framework ask; it was already built upstream (RG-T192, 0c9c3e9, five commits past the pin f211eed). Root cause: filing against the pinned submodule without checking the framework's upstream log/store first (q fts also missed it). Fix: before filing a framework ask, git log pin..upstream HEAD --grep plus q fts in the framework store; orient should print 'pin is N commits behind upstream' for every framework submodule

kit-bug-shape: cap:bug:process-failure-2026-10-10-dirt-empire-filed-nat
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 14:55] (created) bug — Process failure 2026-10-10 (dirt-empire): filed 'native resolution by default' as a new framework ask; it was already built upstream (RG-T19
