---
id: KIT-T644
title: tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resol
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T03:16:16Z
updated: 2026-10-27T21:48:46Z
---

## Description
tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resolves the unexpanded $S path relative to the checkout instead of treating it as unknown/outside

kit-bug-shape: cap:bug:tree-delete-gate-blocks-rm-rf-s-out-where-s-is-a
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] rm of an expanded-variable path is not judged as inside the checkout

## Plan
1.

## Notes
2026-10-27 hooks/lib/tree-delete.mjs: a delete target the shell would expand ($VAR, ${VAR}, $(..), backticks, %VAR%, ~) is unknown and never resolved against the checkout; a cd into one leaves the directory unknown so following relative paths are skipped until an absolute cd. Tests: hooks/tree-delete-gate.test.mjs 25 passed (6 shapes x unit + hook, absolute cd regains tracking, existing literal cases still block); with the fix stashed 12 of them fail. A publish ships it to every session; before it, rm of a $VAR path in a daemon-owned checkout is still refused.

## History
- [2026-10-27 03:16] (created) bug — tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resol
- [2026-10-27 03:16] (comment) seen again in dirt-empire: tree-delete-gate: blocks rm -rf "$S/out" where S is a shell variable pointing at the session scratchpad outside the checkout; the gate resolves the unexpanded $S path relative to the checkout instead of treating it as unknown/outside
- [2026-10-27 03:16] (asked again) 2026-10-27 — cap:bug:tree-delete-gate-blocks-rm-rf-s-out-where-s-is-a
- [2026-10-27 21:48] (comment) criterion added: rm of an expanded-variable path is not judged as inside the checkout
- [2026-10-27 21:48] (comment) ticked: rm of an expanded-variable path is not judged as inside the checkout
- [2026-10-27 21:48] (status) todo → review
