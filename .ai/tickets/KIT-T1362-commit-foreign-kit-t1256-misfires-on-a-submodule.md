---
id: KIT-T1362
title: commit-foreign (KIT-T1256) misfires on a submodule pointer bump: 'git add rapid-game && git commit -- rapid-game' in the superproject is ref
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T01:17:12Z
updated: 2026-11-18T01:26:21Z
---

## Description
commit-foreign (KIT-T1256) misfires on a submodule pointer bump: 'git add rapid-game && git commit -- rapid-game' in the superproject is refused because another live writer has uncommitted files INSIDE the submodule; a gitlink commit records only the submodule's HEAD sha, never its dirty files, so those paths are not taken by the commit. Fix: when the committed path is a gitlink, compare only the recorded pointer, not the submodule's dirty tree (sibling of KIT-T1347)

kit-bug-shape: cap:bug:commit-foreign-kit-t1256-misfires-on-a-submodule:e3b234f6
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A gitlink is judged by the pointer it records: a standing pin claim with the pointer unchanged and only another writer's dirty files inside the submodule refuses nothing (hooks/commit-submodule-pin.test.mjs, failed before the fix)
- [x] A pointer bump with another writer's dirty files inside the submodule and no pin claim passes; a bump that carries another live writer's pinned submodule commit still refuses (KIT-T1257); a real foreign superproject path still blocks with the [commit-foreign: <reason>] hint

## Plan
1.

## Notes
Diagnosis of the 2026-11-18T01:16:55Z refusal in road-generator (session 4100d9bf): the named path was the gitlink rapid-game itself, held by agent af91048cd5f77a4ae's pin claim (KIT-T1257: the agent that commits inside a submodule claims the pin), not files inside the submodule. The bump moved the pointer from 31911229 (c1a2d0d) and, as committed in 6a90016, recorded ae380fc2, which carries af91048's submodule commits 6176d136 and ae380fc2 under the message 'Pin rapid-game to 8cc52c79'. So that refusal was KIT-T1257 working as designed (a true positive); whether a pin claim should refuse another writer's bump is a KIT-T1257 policy question, not changed here. The real defect found: stillDirty (lib/session-overlap.mjs) asked 'git diff --name-only HEAD', which lists a submodule whose files are dirty even when its pointer has not moved, so a standing pin claim refused a superproject commit that records nothing new for the gitlink. Fix: --ignore-submodules=dirty, so a gitlink counts only when the pointer it would record moved. Tests: commit-submodule-pin 10 passed (the dirty-only case failed before the fix); commit-foreign-submodule 6, -moves 9, -newdir 24, -lockfile 6, -subdir-cwd 4, commit-agent-claims 14, claims-release-verb, agent-claims, claim-release, dispatch-holder pass.

## History
- [2026-11-18 01:17] (created) bug — commit-foreign (KIT-T1256) misfires on a submodule pointer bump: 'git add rapid-game && git commit -- rapid-game' in the superproject is ref
- [2026-11-18 01:26] (status) todo → doing
- [2026-11-18 01:26] (comment) criterion added: A gitlink is judged by the pointer it records: a standing pin claim with the pointer unchanged and only another writer's dirty files inside the submodule refuses nothing (hooks/commit-submodule-pin.test.mjs, failed before the fix)
- [2026-11-18 01:26] (comment) criterion added: A pointer bump with another writer's dirty files inside the submodule and no pin claim passes; a bump that carries another live writer's pinned submodule commit still refuses (KIT-T1257); a real foreign superproject path still blocks with the [commit-foreign: <reason>] hint
- [2026-11-18 01:26] (comment) ticked: commit-submodule-pin 10 passed
- [2026-11-18 01:26] (comment) ticked: A pointer bump with another writer's dirty files inside the submodule and no pin claim passes; a bump that carries another live writer's pinned submodule commit still refuses (KIT-T1257); a real foreign superproject path still blocks with the [commit-foreign: <reason>] hint
