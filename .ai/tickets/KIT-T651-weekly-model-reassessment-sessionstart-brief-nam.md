---
id: KIT-T651
title: weekly model-reassessment SessionStart brief names claude-kit-runtime/<sha> as the work dir, but it is not a git repo, so the 'commit and pu
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-27T21:08:27Z
updated: 2026-10-27T21:08:27Z
---

## Description
weekly model-reassessment SessionStart brief names claude-kit-runtime/<sha> as the work dir, but it is not a git repo, so the 'commit and push' step cannot run there. The agent had to copy results into D:\dev\claude-kit by hand. Root cause: the brief resolves the runtime snapshot path instead of the kit source checkout. Fix: point the brief at the registry's claude-kit checkout.

kit-bug-shape: cap:bug:weekly-model-reassessment-sessionstart-brief-nam
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-27 21:08] (created) bug — weekly model-reassessment SessionStart brief names claude-kit-runtime/<sha> as the work dir, but it is not a git repo, so the 'commit and pu
- [2026-10-27 21:08] (comment) seen again in Chris Sparks: weekly model-reassessment SessionStart brief names claude-kit-runtime/<sha> as the work dir, but it is not a git repo
- [2026-10-27 21:08] (asked again) 2026-10-27 — cap:bug:weekly-model-reassessment-sessionstart-brief-nam
