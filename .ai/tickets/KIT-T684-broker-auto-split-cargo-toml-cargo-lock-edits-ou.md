---
id: KIT-T684
title: broker: auto-split Cargo.toml/Cargo.lock edits out of a patch into their own job so the rest is train-eligible (train-form excludes any mani
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:27:21Z
updated: 2026-10-28T22:27:21Z
---

## Description
broker: auto-split Cargo.toml/Cargo.lock edits out of a patch into their own job so the rest is train-eligible (train-form excludes any manifest path; 26 of 68 dirt-empire jobs since 20:00Z on 2026-10-28 carried one, 43 of 241 all day). The split job runs first, the remainder follows with the split as its base; one submit, two results

kit-bug-shape: cap:feature:broker-auto-split-cargo-toml-cargo-lock-edits-ou
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 22:27] (created) feature — broker: auto-split Cargo.toml/Cargo.lock edits out of a patch into their own job so the rest is train-eligible (train-form excludes any mani
