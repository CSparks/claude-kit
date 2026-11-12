---
id: KIT-T1098
title: process failure 2026-11-12 (road-generator main thread): a refactorer dispatch for Dirt Empire was blocked by dispatch-guard conformance-nam
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T17:39:08Z
updated: 2026-11-12T17:46:14Z
---

## Description
process failure 2026-11-12 (road-generator main thread): a refactorer dispatch for Dirt Empire was blocked by dispatch-guard conformance-named; the brief said 'Dirt Empire's framework conformance test stays green' and a [conformance: ...] tag with free text, without the literal test name framework_conformance. Root cause: the orchestrator paraphrased the test name. Prevention: q gates agent prints the exact string the conformance check matches for the current project (the test name), so a brief copies it.

kit-bug-shape: cap:bug:process-failure-2026-11-12-road-generator-main-t
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q gates agent prints the conformance test name the check matches in the current project, derived from the gate's own code; a project without one prints none

## Plan
1.

## Notes
Fixed 61bd992: conformanceTestsFor(root) in hooks/dispatch-conformance.mjs is the single derivation (conformanceBlock uses conformanceTests); gateText(name,{root}) adds the 'in this project: name `X` in the brief' line to the conformance-named row; q-gates/q-lib pass the store root. Tests: node hooks/gate-protocol.test.mjs 42 passed (framework checkout names the test, negative control prints none, CLI run from a checkout); hooks/dispatch-conformance.test.mjs 11 passed; hooks/gate-digest.test.mjs 9 passed. Live: road-generator q gates agent prints framework_conformance.

## History
- [2026-11-12 17:39] (created) bug — process failure 2026-11-12 (road-generator main thread): a refactorer dispatch for Dirt Empire was blocked by dispatch-guard conformance-nam
- [2026-11-12 17:46] (landed) 61bd992 q gates agent names the conformance test the check matches in the current project (implements KIT-T1098)
- [2026-11-12 17:46] (comment) criterion added: q gates agent prints the conformance test name the check matches in the current project, derived from the gate's own code; a project without one prints none
- [2026-11-12 17:46] (comment) ticked: q gates agent prints the conformance test name the check matches in the current project, derived from the gate's own code; a project without one prints none
- [2026-11-12 17:46] (status) todo → review
