---
id: KIT-T474
title: KIT-T472 follow-ups (fast landing pipeline, fffca34): (1) a rapid-game submodule job's affected check covers only rapid-game's workspace, so
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T08:05:17Z
updated: 2026-10-14T08:05:17Z
---

## Description
KIT-T472 follow-ups (fast landing pipeline, fffca34): (1) a rapid-game submodule job's affected check covers only rapid-game's workspace, so a framework API change that breaks the consuming game is caught by the suite, not the gate: also check the superproject; (2) a full-gate landing that ran the suite doesn't mark the suite done, so the cadence re-runs it; (3) the suite yields to every queued job, so a busy queue starves it: give it a max-landings-without-green ceiling; (4) the orient banner doesn't show the suite line; (5) src module → test mapping is word match on the module name; consider a code-graph importers walk.

kit-bug-shape: cap:feature:kit-t472-follow-ups-fast-landing-pipeline-fffca3
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-14 08:05] (created) feature — KIT-T472 follow-ups (fast landing pipeline, fffca34): (1) a rapid-game submodule job's affected check covers only rapid-game's workspace, so
