---
id: KIT-T320
title: broker: land a superproject patch and its submodule pin as ONE commit. Today a --repo rapid-game landing re-pins stiletto at once (scripts/b
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T18:26:43Z
updated: 2026-10-04T18:36:19Z
---

## Description
broker: land a superproject patch and its submodule pin as ONE commit. Today a --repo rapid-game landing re-pins stiletto at once (scripts/broker/submodule.mjs repinSuperproject), so a framework API change followed by the game change that uses it leaves stiletto main not compiling between the two commits (seen repeatedly in ST-T820, and blocks ST-T823's game half G1 + framework retire). Wanted: a framework job that lands WITHOUT re-pinning (--no-pin), and a superproject job flag --pin <submodule>=<sha> that stages the gitlink with the patch paths in the same commit, after the submodule sha is pushed; tests run with the submodule checked out at that sha.

kit-bug-shape: cap:feature:broker-land-a-superproject-patch-and-its-submodu
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] --no-pin lands a submodule commit without re-pinning; --pin name=sha tests with the submodule at that sha and lands the gitlink with the patch paths in one commit; a landing refuses an unpushed sha

## Plan
1.

## History
- [2026-10-04 18:26] (created) feature — broker: land a superproject patch and its submodule pin as ONE commit. Today a --repo rapid-game landing re-pins stiletto at once (scripts/b
- [2026-10-04 18:36] (comment) criterion added: --no-pin lands a submodule commit without re-pinning; --pin name=sha tests with the submodule at that sha and lands the gitlink with the patch paths in one commit; a landing refuses an unpushed sha
- [2026-10-04 18:36] (comment) ticked: --no-pin lands a submodule commit without re-pinning; --pin name=sha tests with the submodule at that sha and lands the gitlink with the patch paths in one commit; a landing refuses an unpushed sha
- [2026-10-04 18:36] (comment) @sonnet55: scripts/broker/pin.mjs (parse/prepare/checkout/revert/settle); submit-lib validates flags; patch.mjs checks the submodul (full comment #1 in ## Notes)
### comment #1 [2026-10-04 18:36] @sonnet55
scripts/broker/pin.mjs (parse/prepare/checkout/revert/settle); submit-lib validates flags; patch.mjs checks the submodule out at the sha for the run (baseline reverts it), adds the gitlink path to the landing paths, settles the submodule back on its branch fast-forwarded to the sha, or reverts it after a check-only/failed run; land.mjs skips the re-pin on noPin. Limits: a daemon crash mid-run leaves the submodule detached at the pinned sha (the file journal does not cover it). Tests: scripts/broker/pin.test.mjs (5 incl. atomic one-commit landing, no-pin leaves super untouched, unpushed sha refused at submit and run time, check-only restore control); mutation (gitlink path dropped from the landing) fails the atomic test. Broker suite 103 passed.
- [2026-10-04 18:36] (status) todo → review
