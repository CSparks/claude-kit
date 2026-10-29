---
id: KIT-T684
title: broker: auto-split Cargo.toml/Cargo.lock edits out of a patch into their own job so the rest is train-eligible (train-form excludes any mani
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T22:27:21Z
updated: 2026-10-28T23:54:21Z
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

## Notes
Built differently from the ticket: no auto-split. A manifest-only job is not safe to land first (a [[test]] entry before its file breaks the build; a check-only job cannot land at all). Instead a Cargo.toml/Cargo.lock edit now rides a train (train-form.mjs no longer excludes manifests; path claims keep two manifest jobs apart) and the rewritten lock lands with the manifest member (train-land.mjs). train-manifest.test.mjs 2 passed (one build for three jobs; lock in the manifest member's commit; same-manifest control). 2026-10-28: 45 of 247 dirt-empire jobs touched a manifest (28 Cargo.toml only, 15 both, 2 lock only).

## History
- [2026-10-28 22:27] (created) feature — broker: auto-split Cargo.toml/Cargo.lock edits out of a patch into their own job so the rest is train-eligible (train-form excludes any mani
- [2026-10-28 23:54] (status) todo → review
