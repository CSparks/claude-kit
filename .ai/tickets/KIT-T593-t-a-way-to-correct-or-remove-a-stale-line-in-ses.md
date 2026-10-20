---
id: KIT-T593
title: t: a way to correct or remove a stale line in SESSION.md (e.g. t session --fix <old> <new>, or t session --drop-citation <path>). t session
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-19T22:55:45Z
updated: 2026-10-20T00:52:50Z
fixed_commit: b6dd07f
---

## Description
t: a way to correct or remove a stale line in SESSION.md (e.g. t session --fix <old> <new>, or t session --drop-citation <path>). t session is append-only, the flush hook demands a bad artifact citation be re-anchored, and nothing sanctioned can do it, so the orchestrator hand-edited the file with node (an end-around). Recurs whenever a session note cites a pipe/glob shorthand or a dead path. Also: q cannot be shown to search a single file cheaply; confirm 'q code <text> --path .ai/SESSION.md' works and say so in orient.

kit-bug-shape: cap:feature:t-a-way-to-correct-or-remove-a-stale-line-in-ses
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-19 22:55] (created) feature — t: a way to correct or remove a stale line in SESSION.md (e.g. t session --fix <old> <new>, or t session --drop-citation <path>). t session
- [2026-10-20 00:52] (status) todo → review
- [2026-10-20 00:52] (comment) t session --fix <old> <new> and --drop <text> (scripts/t-session.mjs); test scripts/t-edit-verbs.test.mjs (10 passed)
