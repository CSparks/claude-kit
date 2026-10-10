---
id: KIT-T379
title: flush.mjs artifact-path check flags slash-separated numbers in SESSION.md as missing artifact paths (false positive on '18.30/17.52', '31.6/
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-07T01:13:06Z
updated: 2026-10-07T01:13:06Z
---

## Description
flush.mjs artifact-path check flags slash-separated numbers in SESSION.md as missing artifact paths (false positive on '18.30/17.52', '31.6/33.5', '20.1/24.3/59.5' in stiletto 2026-10-06); a token with no letters, no extension and no path root is not a path.

kit-bug-shape: cap:bug:flush-mjs-artifact-path-check-flags-slash-separa
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 01:13] (created) bug — flush.mjs artifact-path check flags slash-separated numbers in SESSION.md as missing artifact paths (false positive on '18.30/17.52', '31.6/
