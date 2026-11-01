---
id: KIT-T744
title: PROCESS FAILURE 2026-10-30 (dirt-empire, orchestrator): asked Chris a vehicle-feel questionnaire (wheelie hold: stick-sets-height vs real ba
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-31T00:08:23Z
updated: 2026-10-31T01:18:16Z
fixed_commit: 8a60480
---

## Description
PROCESS FAILURE 2026-10-30 (dirt-empire, orchestrator): asked Chris a vehicle-feel questionnaire (wheelie hold: stick-sets-height vs real balance) without querying the decision store; DE-D071 'vehicle feel sits closest to GTA' already governed it and Chris had to repeat it ('What do I always say? GTA is the model'). Root cause: no gate ties an AskUserQuestion to a q fts of its nouns against decisions; orient's recent-decisions list does not surface standing feel/philosophy rulings older than a few days. Want: AskUserQuestion pre-hook runs q fts on the question nouns and blocks/annotates when a governing decision exists.

kit-bug-shape: cap:bug:process-failure-2026-10-30-dirt-empire-orchestra
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
decision-gate (hooks/decision-gate.mjs, scripts/decision-governs.mjs): a PreToolUse gate on AskUserQuestion matches the questionnaire's distinctive words against the project's in-force decisions (title share of 2, or title+summary+Decision paragraph share of 4; superseded/retired skipped) and blocks that exact questionnaire once, printing each decision's id, title and Decision paragraph; the same questionnaire sent unchanged passes; per-decision exclusion via .claude-kit-ignore.yaml decision-gate. Commit 8a60480. Evidence: hooks/decision-gate.test.mjs 9 passed, reask-gate 15, plugin-compat 138, runtime-wiring 22; dirt-empire's 73 decisions: the wheelie questionnaire matches DE-D071, two unrelated questions match none.

## History
- [2026-10-31 00:08] (created) bug — PROCESS FAILURE 2026-10-30 (dirt-empire, orchestrator): asked Chris a vehicle-feel questionnaire (wheelie hold: stick-sets-height vs real ba
- [2026-10-31 01:16] (landed) 8a60480 decision-gate: an AskUserQuestion that an in-force decision already answers is blocked once with the decision's title an
- [2026-10-31 01:18] (status) todo → done
- [2026-10-31 01:22] (landed) 09a9367 plugin 0.1.28: sessions pick up the decision-gate hook wiring (plugin-compat passed) (implements KIT-T744)
