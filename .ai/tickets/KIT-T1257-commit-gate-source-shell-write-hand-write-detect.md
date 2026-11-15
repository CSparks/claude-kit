---
id: KIT-T1257
title: commit gate (source-shell-write / hand-write-detect): refused a commit of rg-townplan src/lib.rs and src/plan.rs as 'written by a shell call
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T11:35:32Z
updated: 2026-11-15T12:10:58Z
---

## Description
commit gate (source-shell-write / hand-write-detect): refused a commit of rg-townplan src/lib.rs and src/plan.rs as 'written by a shell call' although the committing agent (road-generator fences agent a3afb01d, 2026-11-15) wrote both with the Edit tool; same misfire earlier on examples/fence_preview/scene.rs. The write tracker loses an agent's Edit writes (several agents of one session editing one crate; write-guard refusals and retries in between). The agent had to re-save both files through Edit with a doc touch to commit. Wanted: find why accepted Edit writes are missing from the tracker (a refused-then-retried Edit recorded as refused only? a hash recorded before another writer's edit to the same file?), fix, test with a refused edit followed by an accepted one.

kit-bug-shape: cap:bug:commit-gate-source-shell-write-hand-write-detect:5540f905
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 9f611ce (runtime 9f611ce). Ledger evidence (road-generator toolwrites): refused-then-retried Edits do end in a confirmed entry, so a refused retry is not what loses writes. Defects found and fixed: (1) an agent's own Edit and shell call issued in one batch: its own unconfirmed prediction was never waited for (settle-writes), now pending like another writer's; (2) a flag raised before a confirmation arrived (lag past the 30 s settle) stayed until a re-save: a flag now lapses when a tool write confirmed after it, whose prediction matched, left the file's content (hand-writes.mjs). Not proven: the exact incident chain; the flagged set in the live ledger fits KIT-T1255's cause below. Tests: hooks/hand-write-edit-sequences.test.mjs 14 passed (refused then accepted, two writers one file, own batch, late confirmation, controls: never-confirmed, shell-only write; mutation-checked), hand-write-detect 73, shell-attribution 65, tool-writes-race 8. Pre-existing and untouched: hooks/hand-write-restore.test.mjs 2 controls fail on the published runtime 3bdc6e3 too (KIT-T982 earlier-Edit-content controls vs the KIT-T1212 own-confirmed rule). Also KIT-T1256 limit closed: the agent that commits inside a submodule claims the gitlink; another agent's superproject commit is refused for the pin (hooks/commit-submodule-pin.test.mjs 6 passed).

## History
- [2026-11-15 11:35] (created) bug — commit gate (source-shell-write / hand-write-detect): refused a commit of rg-townplan src/lib.rs and src/plan.rs as 'written by a shell call
- [2026-11-15 12:09] (landed) 9f611ce The hand-write check no longer blames a shell call for an Edit's content or for a touched file, and a commit refuses a s
- [2026-11-15 12:10] (status) todo → review
