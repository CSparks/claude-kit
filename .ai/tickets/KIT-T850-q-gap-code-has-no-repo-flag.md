---
id: KIT-T850
title: q gap: 'code' has no --repo flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-03T02:16:24Z
updated: 2026-11-03T16:31:41Z
---

## Description
q code --repo --path C:/Users/Chris Sparks/.claude/claude-kit-runtime/current/docs/BROKER.md

kit-bug-shape: q-gap:flag:code:--repo
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --repo <project|dir> searches that checkout; a bare --repo is a no-op; an unknown value says so; q-code-target 8 passed

## Plan
1.

## Notes
The flag q code --repo <x> takes a registered project (as --project) else an existing directory (as --dir); an unknown value errors. A bare --repo (the reported 'q code --repo --path ...') means the cwd repo. Resolution lives in q-code-target.mjs.

## History
- [2026-11-03 02:16] (created) bug — q gap: 'code' has no --repo flag
- [2026-11-03 16:23] (status) todo → doing
- [2026-11-03 16:31] (comment) criterion added: q code --repo <project|dir> searches that checkout; a bare --repo is a no-op; an unknown value says so; q-code-target 8 passed
- [2026-11-03 16:31] (comment) ticked: q code --repo <project|dir> searches that checkout; a bare --repo is a no-op; an unknown value says so; q-code-target 8 passed
- [2026-11-03 16:31] (status) doing → review
