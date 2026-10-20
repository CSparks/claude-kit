---
id: KIT-T571
title: broker wedged in dirty hold: job j-mvekiha9-oya0no hit 'dirty at apply' 20:20 CDT while another agent hand-edited; the edits were committed
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T02:12:47Z
updated: 2026-10-19T02:12:47Z
---

## Description
broker wedged in dirty hold: job j-mvekiha9-oya0no hit 'dirty at apply' 20:20 CDT while another agent hand-edited; the edits were committed (ff588dd, tree clean by 20:31) but target/broker/phase.json stays phase=apply and dirty-hold.json stays for that id; daemon pid 10328 alive and beating; resubmitting with --revises (new job j-mvem0oux-3uf13n) just sits 'queued at position 1 of 1' for 10+ min. Dirty hold never re-checks the tree and never releases.

kit-bug-shape: cap:bug:broker-wedged-in-dirty-hold-job-j-mvekiha9-oya0n
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 02:12] (created) bug — broker wedged in dirty hold: job j-mvekiha9-oya0no hit 'dirty at apply' 20:20 CDT while another agent hand-edited; the edits were committed
