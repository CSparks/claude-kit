---
id: KIT-T807
title: q launcher: documented raw node path form word-splits on a home dir with a space (C:\Users\Chris Sparks); docs and agent text must name the
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-01T21:46:36Z
updated: 2026-11-01T21:50:42Z
---

## Description
q launcher: documented raw node path form word-splits on a home dir with a space (C:\Users\Chris Sparks); docs and agent text must name the bare q shim and quote any raw path

kit-bug-shape: cap:bug:q-launcher-documented-raw-node-path-form-word-sp
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: bare q shims already ship (bin/q, bin/q.cmd, KIT-T180) but docs, agent text and the composed CLAUDE.md printed the raw node path, which agents stored in an unquoted variable and word-split on a home dir with a space. Fix: docs name bare q with a quoted fallback; bootstrap composes a quoted kit path with HOME. Test: scripts/q-launcher.test.mjs 5 passed, runtime-wiring 22 passed, flush 27 passed.

## History
- [2026-11-01 21:46] (created) bug — q launcher: documented raw node path form word-splits on a home dir with a space (C:\Users\Chris Sparks); docs and agent text must name the
- [2026-11-01 21:50] (status) todo → review
- [2026-11-01 21:50] (landed) d100660 fix: bare q is the documented command, raw node paths quoted; maintainer's word closes tickets; silence bookkeeping nags
- [2026-11-01 22:06] (landed) 6c9fd22 chore: bump plugin to 0.1.29 so changed agent and command text reaches sessions (implements KIT-T807)
- [2026-11-01 22:10] (landed) 48f386b chore: Codex manifest version 0.1.29 to match the Claude manifest (implements KIT-T807)
