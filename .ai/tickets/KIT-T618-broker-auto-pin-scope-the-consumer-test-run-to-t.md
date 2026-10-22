---
id: KIT-T618
title: broker auto-pin: scope the consumer test run to the pin delta. When a rapid-game landing's changed crates (git diff old..new pin, mapped to
type: feature
status: review
priority: high
asked: 2
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-22T02:48:39Z
updated: 2026-10-22T03:31:16Z
---

## Description
broker auto-pin: scope the consumer test run to the pin delta. When a rapid-game landing's changed crates (git diff old..new pin, mapped to workspace members) are absent from the consumer's Cargo.lock closure, the auto-pin runs the build check only (cargo t --no-run) and commits the pin, citing 'no crate in this consumer's closure changed'; full cargo t only when the delta reaches the closure. Coalesce: a queued auto-pin superseded by a newer one for the same consumer is dropped. Evidence 2026-10-21: stiletto auto-pin runs full cargo t --no-fail-fast -j 3 (~1.5 h) per landing and the rapid-game lane yields its tree to it, so 10 rg-vehicle/rg-physics patches (neither crate in stiletto Cargo.lock) cost ~18 h. Keeps KIT-T563 (auto-pin every landing, Chris 2026-10-17) intact; relates KIT-T559 (gate scope to changed crates + reverse deps).

kit-bug-shape: cap:feature:broker-auto-pin-scope-the-consumer-test-run-to-t
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Built: scripts/broker/pin-scope.mjs (pin delta -> crates, Cargo.lock closure, build-only commands), hook in patch.mjs for autoPin jobs, trailer note via trailer.mjs; scripts/broker/autopin-supersede.mjs (queue.mjs drops a queued auto-pin a newer descendant pin covers, status superseded). A file no crate owns (outside docs/.ai/.claude/.github, md/txt) or a missing lock keeps the full verify. Tests: pin-scope.test.mjs 6 passed (build-only, in-closure control, unmapped control, buildOnly, supersede, older-after-newer control); autopin, autopin-affected, pin, patch, land-gate, withdraw, train-gate: 44 passed total.

## History
- [2026-10-22 02:48] (created) feature — broker auto-pin: scope the consumer test run to the pin delta. When a rapid-game landing's changed crates (git diff old..new pin, mapped to
- [2026-10-22 02:49] (comment) seen again in claude-kit: broker auto-pin: scope the consumer test run to the pin delta (build-only when no changed rapid-game crate is in the consumer Cargo.lock closure) and drop superseded queued pins. Evidence 2026-10-21: stiletto auto-pin runs full cargo t (~1.5 h) per landing and the rapid-game lane yields to it; 10 rg
- [2026-10-22 02:49] (asked again) 2026-10-22 — cap:feature:broker-auto-pin-scope-the-consumer-test-run-to-t
- [2026-10-22 03:31] (status) todo → review
