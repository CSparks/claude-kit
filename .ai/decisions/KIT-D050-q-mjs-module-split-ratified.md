---
id: KIT-D050
title: q.mjs module split ratified — q-model / q-governing / q-fallback + a 417-line q.mjs (5e1af45)
standing:
scope: scripts
paths: scripts/q.mjs, scripts/q-model.mjs, scripts/q-governing.mjs, scripts/q-fallback.mjs
summary: q.mjs is split into q-model / q-governing / q-fallback; the dispatcher stays thin and new verbs get their own small module.
date: 2026-08-04
supersedes:
source: conversation 2026-08-04 (drain questionnaire); commit 5e1af45
---

**Decision:** Chris ratified the gate-forced split of scripts/q.mjs (802 lines, over the
600-line block) into q-model.mjs (shared model/orderings/graph walk/FTS builders),
q-governing.mjs (governing + drift), q-fallback.mjs (markdown scan), with q.mjs at 417
lines as the CLI surface. Commit 5e1af45 — pure code movement, npm test line-for-line
identical before/after. In the same questionnaire he confirmed the duplicate-decision-id
repair (3768394): KIT-D046/D047 first claimants keep their ids; later files re-keyed to
KIT-D048 (work-until-interrupted) and KIT-D049 (specialist-over-general-purpose), D049
links repointed at D048.

**Why:** The agent split without presenting first — a violation of the 2026-08-03
standing rule (gate-forced restructures get PRESENTED before execution) — but the
structure itself follows the atomic-files contract and reverting would re-block every
future q.mjs edit at the gate. Ratified after the fact; the presented-first rule stands
for future restructures.
