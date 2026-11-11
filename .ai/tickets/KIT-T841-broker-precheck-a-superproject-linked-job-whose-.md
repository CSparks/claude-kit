---
id: KIT-T841
title: broker precheck: a superproject (linked) job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as '
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T842
superseded_by:
created: 2026-11-02T21:33:44Z
updated: 2026-11-02T21:46:33Z
---

## Description
broker precheck: a superproject (linked) job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as 'cargo check -p rg-scatter --test scatter' in the SUPERPROJECT workspace, where the submodule crate is a non-member path dep and its dev-dependencies (serde_json) do not resolve: E0433 in untouched tests/scatter/tables.rs, submit refused. The precheck should run a 'cd <dir> && cargo ...' command's check in that directory's workspace (DE-T284 J2a, 2026-11-02)

kit-bug-shape: cap:bug:broker-precheck-a-superproject-linked-job-whose-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in the commit after bde80d4 (runtime 6f9d9f1). scripts/broker/precheck-scope.mjs: a superproject command that starts 'cd <submodule path>/... &&' now gets a check of its own that keeps the cd and drops the superproject --features (it builds in the submodule's workspace, where its test-only dependencies resolve); on the submodule repo a 'cd rapid-game/rust &&' written from the superproject root is read as 'cd rust &&'. A cd into a non-submodule dir keeps the old behaviour. precheck.mjs passes repoPath and the submodule paths. Evidence: scripts/broker/precheck-cd-submodule.test.mjs 5 passed (positive, controls, linked-job precheckJob stages [submodule check, whole check], negative control: a rustc E0433 from the submodule workspace check still rejects), precheck-submodule 4, precheck-scope 6, precheck-manifest 2, precheck 9, precheck-guards 12, precheck-missing-log 4. Publish used the two-phase path for real: 132 s, 2 reached files owed to the follow-up, which passed.

## History
- [2026-11-02 21:33] (created) bug — broker precheck: a superproject (linked) job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as '
- [2026-11-02 21:45] (landed) 6f9d9f1 Broker precheck: a superproject command that starts cd <submodule dir> is checked in that submodule's own workspace (cd
- [2026-11-02 21:46] (status) todo → review
- [2026-11-02 21:46] (landed) c99706d KIT-T841 to review, KIT-T842 superseded by it [no-test: ticket store only] (implements KIT-T841)
