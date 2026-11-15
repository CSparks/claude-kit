---
id: KIT-T1251
title: checkout-holder (KIT-T1114) misattributes half-edited crates: while houses agent a70f54bfd9ae58e5d edited only rg-buildings, its refusal lis
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T09:22:14Z
updated: 2026-11-15T09:44:51Z
---

## Description
checkout-holder (KIT-T1114) misattributes half-edited crates: while houses agent a70f54bfd9ae58e5d edited only rg-buildings, its refusal listed rg-daylight and rg-townplan (never edited by this agent) and rg-shader-kit (edited and cargo-checked green earlier) as 'YOUR CRATE IS LEFT HALF EDITED'. The ledger likely keys on the session not the agent, or never clears after a covering check.

kit-bug-shape: cap:bug:checkout-holder-kit-t1114-misattributes-half-edi:8c45f692
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in cd02108 (runtime cd02108). Cause, from the road-generator ledger: entries are keyed per agent (writer session|agent), so agents of one session never shared a list. The false crates were the agent's own earlier edits (a70f54 edited rg-daylight 22:46, rg-townplan 23:22, rg-shader-kit through 06:50) in sessions whose crate-check recorder was never loaded: no check was ever recorded, so every past edit read as unchecked for ever, green or not. Now only edits of the last 30 min count, and only while some writer's check was recorded in the last 12 h. Tests: hooks/broken-crates.test.mjs 33 passed (two agents of one session on different crates; old edit; no recorder), crate-check 18, build-write-hold 60 in the working tree; broken-crates 33 from the export.

## History
- [2026-11-15 09:22] (created) bug — checkout-holder (KIT-T1114) misattributes half-edited crates: while houses agent a70f54bfd9ae58e5d edited only rg-buildings, its refusal lis
- [2026-11-15 09:44] (status) todo → review
