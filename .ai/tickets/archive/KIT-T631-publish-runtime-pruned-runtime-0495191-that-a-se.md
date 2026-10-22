---
id: KIT-T631
title: publish:runtime pruned runtime 0495191 that a session still called by path (t.mjs MODULE_NOT_FOUND); a pin covers only brokers and the q-server (follow-up to KIT-T486)
type: bug
status: done
priority: high
milestone:
labels: []
links: [KIT-T486]
files: []
supersedes:
superseded_by:
created: 2026-10-22T19:44:54Z
updated: 2026-10-22T21:48:41Z
fixed_commit: 3159c9f
---

## Description
2026-10-22: publish of 1c6f961 deleted claude-kit-runtime/0495191. The coordinator session's t.mjs calls through that sha path failed with MODULE_NOT_FOUND. NOT a live-daemon regression of KIT-T486: stiletto daemons 54232 (idle-exit 04:58Z Oct 22, log daemon-2026-10-21T22-55-36-320Z-54232.log) and 44936 (restarted from current 05:29Z Oct 22) were gone before the 18:51Z publish; the live stiletto daemon 20628 runs runtime 1c6f961. Gap: only pinRuntime() marks (brokers, q-server) and broker locks hold a copy; an interactive session or wait.mjs that calls scripts by sha path has no mark. Fix: prune also keeps copies younger than 72 h and copies named on a live process command line (scripts/runtime-refs.mjs).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Prune keeps a copy younger than 72 h and a copy a live process names on its command line (Windows backslash, forward-slash and msys forms)
- [x] Negative control: an old copy no process names is still pruned

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T486, KIT-T492
Tests: scripts/runtime-publish.test.mjs 19 pass (4 new incl. negative control). Live check 2026-10-22 14:5x local: stiletto daemon 20628 runs runtime 1c6f961 (lock.runtime); no broker pid references 0495191; the DE daemon 68316 runs from the repo checkout.

## History
- [2026-10-22 19:44] (created) bug — publish:runtime pruned runtime 0495191 that a session still called by path (t.mjs MODULE_NOT_FOUND); a pin covers only brokers and the q-server (follow-up to KIT-T486)
- [2026-10-22 21:47] (comment) criterion added: Prune keeps a copy younger than 72 h and a copy a live process names on its command line (Windows backslash, forward-slash and msys forms)
- [2026-10-22 21:47] (comment) criterion added: Negative control: an old copy no process names is still pruned
- [2026-10-22 21:47] (comment) ticked: Prune keeps a copy younger than 72 h and a copy a live process names on its command line (Windows backslash, forward-slash and msys forms)
- [2026-10-22 21:47] (comment) ticked: Negative control: an old copy no process names is still pruned
- [2026-10-22 21:48] (status) todo → done
