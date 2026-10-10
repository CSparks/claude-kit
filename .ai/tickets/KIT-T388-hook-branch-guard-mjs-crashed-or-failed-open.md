---
id: KIT-T388
title: hook branch-guard.mjs crashed or failed open
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-07T19:46:01Z
updated: 2026-10-07T19:46:01Z
---

## Description
file:///D:/dev/claude-kit/hooks/branch-guard.mjs:26 | const cdTarget = (seg) => { const m = seg.match(/^cds+(?:/ds+)?(S.*)$/s); return m ? toPath(m[1].trim()) : ''; }; |                                                 ^^^^^^^^^^^^

kit-bug-shape: hook-error:branch-guard.mjs
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-07 19:46] (created) bug — hook branch-guard.mjs crashed or failed open
- [2026-10-07 19:46] (comment) seen again in Chris Sparks: file:///D:/dev/claude-kit/hooks/branch-guard.mjs:26 | const cdTarget = (seg) => { const m = seg.match(/^cds+(?:/ds+)?(S.*)$/s); return m ? toPath(m[1].trim()) : ''; }; | ^^^^^^^^^^^^
- [2026-10-07 19:46] (comment) seen again in stiletto-2349: file:///D:/dev/claude-kit/hooks/branch-guard.mjs:26 | const cdTarget = (seg) => { const m = seg.match(/^cds+(?:/ds+)?(S.*)$/s); return m ? toPath(m[1].trim()) : ''; }; | ^^^^^^^^^^^^
- [2026-10-07 19:46] (comment) seen again in Chris Sparks: file:///D:/dev/claude-kit/hooks/branch-guard.mjs:1 | /&&||||[;&|]/#!/usr/bin/env node | ^
- [2026-10-07 19:46] (comment) seen again in stiletto-2349: file:///D:/dev/claude-kit/hooks/branch-guard.mjs:1 | /&&||||[;&|]/#!/usr/bin/env node | ^
