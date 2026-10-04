---
id: KIT-T321
title: broker: after a --repo rapid-game --no-pin landing the live submodule checkout stays at the new (unpinned) sha, so every OTHER stiletto job
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T18:39:24Z
updated: 2026-10-04T18:42:35Z
---

## Description
broker: after a --repo rapid-game --no-pin landing the live submodule checkout stays at the new (unpinned) sha, so every OTHER stiletto job built meanwhile compiles against a framework the superproject does not pin; a breaking framework change (e.g. a crate rename landed with --no-pin before its game half) breaks unrelated stiletto jobs. A stiletto job without --pin should build and test with each submodule checked out at the sha the superproject HEAD records (restoring the checkout afterwards), so only --pin jobs see a moved framework.

kit-bug-shape: cap:bug:broker-after-a-repo-rapid-game-no-pin-landing-th
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a superproject job without --pin builds, tests and lands with each submodule at the sha HEAD records and restores the checkout; uncommitted submodule work refuses the job

## Plan
1.

## History
- [2026-10-04 18:39] (created) bug — broker: after a --repo rapid-game --no-pin landing the live submodule checkout stays at the new (unpinned) sha, so every OTHER stiletto job
- [2026-10-04 18:42] (comment) criterion added: a superproject job without --pin builds, tests and lands with each submodule at the sha HEAD records and restores the checkout; uncommitted submodule work refuses the job
- [2026-10-04 18:42] (comment) ticked: a superproject job without --pin builds, tests and lands with each submodule at the sha HEAD records and restores the checkout; uncommitted submodule work refuses the job
- [2026-10-04 18:42] (comment) @sonnet55: pin.mjs implicitPins: for every submodule the job does not pin, check out the sha HEAD records for the run (skipped when (full comment #1 in ## Notes)
### comment #1 [2026-10-04 18:42] @sonnet55
pin.mjs implicitPins: for every submodule the job does not pin, check out the sha HEAD records for the run (skipped when already there; refuses when it must move and the submodule is dirty); baseline keeps the implicit pins, only explicit pins revert for the pre-patch run; after landing or failure implicit pins revert to the submodule's own branch, explicit ones settle at their sha; the gitlink is committed only for explicit pins. Tests: scripts/broker/pin.test.mjs 9 (+4: land and check-only build at the pin, --pin still uses its sha, dirty submodule refuses and is untouched); mutation (no implicit pins) fails 3. Broker suite 107 passed.
- [2026-10-04 18:42] (status) todo → review
