---
id: KIT-T288
title: request-gate ignores captures written to another store: a request routed into the claude-kit store (cap --project claude-kit, t new in D:/dev/claude-kit) from a stiletto session still trips 'Possible un-captured request' at Stop; the gate should count writes to any store this session touched (project, framework, kit) — kit-bug, hit 2026-10-02
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes: KIT-T196
superseded_by:
created: 2026-10-02T15:59:39Z
updated: 2026-10-02T16:01:16Z
---

## Description
request-gate now also checks the inbox/tickets/decisions/questions/notes of every adopted framework store and every registered project (the kit included) for items written since the prompt; any new or changed item there counts as routed. The project's own tickets stay excluded (edited every turn). Test: hooks/request-gate.test.mjs case 23 (fails before; the suite also isolates the registry now).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a capture routed into another registered store, a framework store or the kit store releases the request gate

## Plan
1.

## History
- [2026-10-02 15:59] (created) bug — request-gate ignores captures written to another store: a request routed into the claude-kit store (cap --project claude-kit, t new in D:/dev/claude-kit) from a stiletto session still trips 'Possible un-captured request' at Stop; the gate should count writes to any store this session touched (project, framework, kit) — kit-bug, hit 2026-10-02
- [2026-10-02 16:01] (comment) criterion added: a capture routed into another registered store, a framework store or the kit store releases the request gate
- [2026-10-02 16:01] (comment) ticked: a capture routed into another registered store, a framework store or the kit store releases the request gate
- [2026-10-02 16:01] (status) todo → review
- [2026-10-02 16:08] (comment) @claude: Scope ruling Chris 2026-10-02: default scope = session repo + its submodules; a capture into an explicitly named other s (full comment #1 in ## Notes)
### comment #1 [2026-10-02 16:08] @claude
Scope ruling Chris 2026-10-02: default scope = session repo + its submodules; a capture into an explicitly named other store (e.g. the kit, per the kit-bug rule) counts as routed. Do NOT make the gate count arbitrary stores — only the session scope plus stores the session explicitly wrote to.
- [2026-10-02 16:08] (comment) @claude: Exception Chris 2026-10-02: the kit store is always in scope from any session (kit bugs AND needed kit features, dispatc (full comment #2 in ## Notes)
### comment #2 [2026-10-02 16:08] @claude
Exception Chris 2026-10-02: the kit store is always in scope from any session (kit bugs AND needed kit features, dispatched immediately unless told otherwise). Gate: session scope + kit store + any explicitly named store.
