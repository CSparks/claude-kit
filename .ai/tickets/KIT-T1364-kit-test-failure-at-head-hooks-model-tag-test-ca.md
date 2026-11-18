---
id: KIT-T1364
title: kit test failure at HEAD: hooks model-tag test case 'display: the fable alias' fails (63 of 64 pass) at runtime 48a7a74d and 2e94012f, found
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T01:47:23Z
updated: 2026-11-18T01:50:19Z
---

## Description
kit test failure at HEAD: hooks model-tag test case 'display: the fable alias' fails (63 of 64 pass) at runtime 48a7a74d and 2e94012f, found by the KIT-T1363 agent; the dispatch description tag display for the fable alias (the gate that names the [Family N.M] value) may print wrongly for Fable dispatches: root-cause and fix honestly

kit-bug-shape: cap:bug:kit-test-failure-at-head-hooks-model-tag-test-ca:4597a30c
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] hooks/model-tag.test.mjs checks that each alias (opus, fable, sonnet) displays as the id the capability table maps it to, read independently of model-tag.mjs; 65 passed, 0 failed

## Plan
1.

## Notes
Root cause: the test was stale; the gate is right. The model reassessment of 2026-11-11 (commit 2a0052e7) moved the fable alias in .ai/config.yml dispatch.aliases to claude-fable-5-2, and modelDisplay('fable') reads that table (readLadder().aliases), so it shows 'Fable 5.2', which is what today's [Fable 5.2] descriptions carried through dispatch-label. hooks/model-tag.test.mjs line 87 still hardcoded 'Fable 5.1' from the 2026-10-10 lineup (f64e051e) and was not updated with the table. Fix: the alias checks (opus, fable, sonnet) compare modelDisplay(alias) with the display built from the table's own id for that alias by a parser in the test, so the next reassessment moves both together; a further check proves the table entries are real ids and that an older id (claude-fable-5-1) keeps its own minor. The check stays as strict: a display that ignored the table, or dropped the minor, fails. Tests: model-tag 65 passed, 0 failed.

## History
- [2026-11-18 01:47] (created) bug — kit test failure at HEAD: hooks model-tag test case 'display: the fable alias' fails (63 of 64 pass) at runtime 48a7a74d and 2e94012f, found
- [2026-11-18 01:50] (status) todo → doing
- [2026-11-18 01:50] (comment) criterion added: hooks/model-tag.test.mjs checks that each alias (opus, fable, sonnet) displays as the id the capability table maps it to, read independently of model-tag.mjs; 65 passed, 0 failed
- [2026-11-18 01:50] (comment) ticked: model-tag 65 passed
