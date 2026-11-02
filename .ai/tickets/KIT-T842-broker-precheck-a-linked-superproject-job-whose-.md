---
id: KIT-T842
title: broker precheck: a linked superproject job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as 'ca
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T841
created: 2026-11-02T21:33:58Z
updated: 2026-11-02T21:46:39Z
---

## Description
broker precheck: a linked superproject job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as 'cargo check -p rg-scatter --test scatter' in the SUPERPROJECT workspace, where the submodule crate is a non-member path dep and its dev-dependencies (serde_json) do not resolve: E0433 in untouched tests/scatter/tables.rs, submit refused. The precheck should check a 'cd <dir> && cargo ...' command in that directory's workspace (related KIT-T522; DE-T284 J2a 2026-11-02)

kit-bug-shape: cap:bug:broker-precheck-a-linked-superproject-job-whose-
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Duplicate of KIT-T841 (same precheck bug filed twice by the patch worker, 2026-11-02); fixed there in runtime 6f9d9f1.

## History
- [2026-11-02 21:33] (created) bug — broker precheck: a linked superproject job whose --test is 'cd rapid-game/rust && cargo t -p rg-scatter --test scatter' is prechecked as 'ca
- [2026-11-02 21:45] (landed) 6f9d9f1 Broker precheck: a superproject command that starts cd <submodule dir> is checked in that submodule's own workspace (cd
- [2026-11-02 21:46] (status) todo → superseded (by KIT-T841)
- [2026-11-02 21:46] (status) superseded → superseded
