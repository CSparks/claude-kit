---
id: KIT-T669
title: q code finds nothing in unregistered clones of an adopted repo: 'q code rg-inventory' run in D:/dev/rg-lanes/_land (a clone of CSparks/rapid
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-28T06:56:31Z
updated: 2026-10-28T06:56:31Z
---

## Description
q code finds nothing in unregistered clones of an adopted repo: 'q code rg-inventory' run in D:/dev/rg-lanes/_land (a clone of CSparks/rapid-game) returned no results while the text exists in docs/CHOICES.toml:834 at origin/main. q only indexes registry-mapped checkouts, so agents working in temp clones get silent empty answers (and fall back to Read/Glob). Root cause: q resolves its index from the machine registry, not the cwd's repo; it should index (or at least warn about) an unregistered git checkout it is run inside. Seen 2026-10-28 overnight fan-out.

kit-bug-shape: cap:bug:q-code-finds-nothing-in-unregistered-clones-of-a
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-28 06:56] (created) bug — q code finds nothing in unregistered clones of an adopted repo: 'q code rg-inventory' run in D:/dev/rg-lanes/_land (a clone of CSparks/rapid
