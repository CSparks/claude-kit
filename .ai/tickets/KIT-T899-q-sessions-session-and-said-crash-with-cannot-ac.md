---
id: KIT-T899
title: q sessions, session and said crash with 'Cannot access args before initialization': q-lib.mjs uses args in the sessions branch before its const declaration
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T19:03:42Z
updated: 2026-11-08T19:03:42Z
---

## Description
scripts/q-lib.mjs main(): the sessions/session/said branch passes args to runSessions before 'const args = scopeFlagToPositional(...)' is initialised, so every q sessions / q session / q said call throws. Fix: pass rawArgs. Found while adding q gates (KIT-T898).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q sessions/session/said run without a use-before-initialisation crash (hooks/gate-protocol.test.mjs q said check)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T100

## History
- [2026-11-08 19:03] (created) bug — q sessions, session and said crash with 'Cannot access args before initialization': q-lib.mjs uses args in the sessions branch before its const declaration
- [2026-11-08 19:13] (comment) criterion added: q sessions/session/said run without a use-before-initialisation crash (hooks/gate-protocol.test.mjs q said check)
- [2026-11-08 19:13] (comment) ticked: q sessions/session/said run without a use-before-initialisation crash (hooks/gate-protocol.test.mjs q said check)
