---
id: KIT-T890
title: Process failure 2026-11-08 (dirt-empire): orchestrator presented a kit-authored base-CLAUDE.md line (KIT-T226: 'never run repo-mutating clea
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T16:21:40Z
updated: 2026-11-08T16:21:40Z
---

## Description
Process failure 2026-11-08 (dirt-empire): orchestrator presented a kit-authored base-CLAUDE.md line (KIT-T226: 'never run repo-mutating cleanup in the live checkout') as the maintainer's own rule and used it to refuse a lossless restore of broker-made drift, stalling the bill. Root causes: (1) the line carries no author or decision id - it was copied from a process-failure ticket's antidote list into base CLAUDE.md, so it reads as a maintainer directive; (2) orchestrator did not check the rule's trigger (maintainer's uncommitted WIP) against the case (broker-made drift). Maintainer's actual rule: be careful, do not LOSE code. Fix: reword the base line to that rule (stash/backup first, never discard unrecorded work) and demote KIT-T226 antidotes to guidance.

kit-bug-shape: cap:bug:process-failure-2026-11-08-dirt-empire-orchestra
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-08 16:21] (created) bug — Process failure 2026-11-08 (dirt-empire): orchestrator presented a kit-authored base-CLAUDE.md line (KIT-T226: 'never run repo-mutating clea
