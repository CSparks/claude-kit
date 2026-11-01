---
id: KIT-T452
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T741
superseded_by:
created: 2026-10-13T19:56:12Z
updated: 2026-10-30T21:48:27Z
---

## Description
q: q code "events:" --path .ai/config.yml -C 3  then  grep: events:

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Most logged recurrences (a|b without --regex, an empty filter set) were already answered by c6cd74d (KIT-T311/T324). Remaining gap fixed: --path <one literal file> naming an existing file the index skips (e.g. a gitignored Cargo.lock) is scanned from disk, so the answer is not empty. Evidence: scripts/code-index.test.mjs 26 passed, scripts/q.test.mjs 112 passed.

## History
- [2026-10-13 19:56] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-10-14 19:13] (comment) seen again in stiletto-2349: q: q code "runner" --path scripts/broker/config.mjs -C 1 2>&1 then grep: land_gate|runner|suite_every|jobs
- [2026-10-15 10:38] (comment) seen again in dirt-empire: q: q code "spawned-by|ensureDaemon|ensureBroker" --regex --path scripts/broker/*.test.mjs then grep: control.mjs
- [2026-10-15 13:29] (comment) seen again in dirt-empire: q: q code "capture\(" --path scripts/broker/preimage.mjs then grep: capture(
- [2026-10-16 20:34] (comment) seen again in stiletto-2349: q: q code "tick(" --path scripts --regex 2>&1 then grep: tick
- [2026-10-17 22:06] (comment) seen again in rapid-game: q: q code "pin-only" --path scripts/broker 2>&1 then grep: ^broker
- [2026-10-18 03:38] (comment) seen again in stiletto-2349: q: q code "export async function payload" -A12 hooks/lib.mjs 2>&1 then grep: payload
- [2026-10-18 20:36] (comment) seen again in dirt-empire: q: q code "deck" --path .ai/config.yml 2>&1 then grep: deck\|clone\|submodule\|git
- [2026-10-27 03:56] (comment) seen again in dirt-empire: q: q code 'name = "bevy_gltf"' --path Cargo.lock -A 2 2>&1 then grep: ^name = "bevy"$
- [2026-10-27 21:34] (comment) seen again in stiletto-2349: q: q code "Cargo.lock" -l --path scripts/broker --kind code then grep: Cargo.lock
- [2026-10-29 01:14] (comment) seen again in dirt-empire: q: q code "Assets<Image>" --lang rust --path rapid-game/rust/ui/rg-ui-bevy 2>&1 then grep: fn \|get_mut\|Assets<Image>
- [2026-10-29 02:45] (comment) seen again in dirt-empire: q: q code "mass" --path crates/dirt-empire/src/truck --lang rust then grep: fn mass\|body_mass\|\.mass
- [2026-10-29 16:43] (comment) seen again in dirt-empire: q: q code "alias" --path .cargo then grep: ^t \|^t=\|\[alias\]
- [2026-10-30 04:09] (comment) seen again in dirt-empire: q: q code "pub struct FrameCount" --registry bevy_diagnostic-0.19.1 then grep: pub fn\|pub struct\|pub enum
- [2026-10-30 21:48] (status) todo → review
- [2026-10-30 21:48] (landed) 5a59504 q code --path <file> searches an existing unindexed file from disk instead of answering empty; implements KIT-T452
