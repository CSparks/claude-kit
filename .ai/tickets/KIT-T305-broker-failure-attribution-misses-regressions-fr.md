---
id: KIT-T305
title: broker failure attribution misses regressions from a two-repo change: the superproject half's baseline ('without the patch') already include
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T10:13:16Z
fixed_commit: 76ceaf9dceb9586065331f5f6e5978052006140a
updated: 2026-10-03T10:15:31Z
---

## Description
broker failure attribution misses regressions from a two-repo change: the superproject half's baseline ('without the patch') already includes the just-landed submodule half and its pin, so tests the submodule half broke fail in the baseline too and are deferred as 'foreign'. Seen: stiletto j-mus6ma4

kit-bug-shape: cap:bug:broker-failure-attribution-misses-regressions-fr
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A superproject job with a paired submodule pin for its ticket (since its base) fails a failing test as 'suspect: paired pin <sha>' instead of deferring it; a pin for another ticket keeps today's deferral

## Plan
1.

## History
- [2026-10-03 10:13] (created) bug — broker failure attribution misses regressions from a two-repo change: the superproject half's baseline ('without the patch') already include
- [2026-10-03 10:15] (comment) criterion added: A superproject job with a paired submodule pin for its ticket (since its base) fails a failing test as 'suspect: paired pin <sha>' instead of deferring it; a pin for another ticket keeps today's deferral
- [2026-10-03 10:15] (comment) ticked: A superproject job with a paired submodule pin for its ticket (since its base) fails a failing test as 'suspect: paired pin <sha>' instead of deferring it; a pin for another ticket keeps today's deferral
- [2026-10-03 10:15] (status) todo → review
- [2026-10-03 10:15] (comment) @sonnet55: (fixed) 76ceaf9dceb9586065331f5f6e5978052006140a

## Notes
Fix 76ceaf9dceb9586065331f5f6e5978052006140a: scripts/broker/paired.mjs (pairedPins: `chore: pin <path> <sha> — ... (implements <ticket>)` commits in base..HEAD for the job ticket; suspects), wired in patch.mjs runCommands, printed by report.mjs.

Choice: the suspect option, not the old-sha baseline. A true baseline needs the live checkout moved to the pre-pin commit with the submodule checked out at its old sha, then a rebuild of the whole workspace twice, inside the tree the broker shares with hand-driven writers and the shared target dir; a failure to restore leaves a wrong submodule pointer. The suspect path is read-only (one git log) and runs BEFORE the baseline, so it also saves the baseline run. Cost: a failure that really predates both halves also fails the job (visible as suspect, the worker confirms by hand) instead of being deferred, which only happens on the rare two-repo jobs. Real case: j-mus6ma4n-vr9qbz base cee17cc7, pin fc6bf321 (implements ST-T818) is in base..HEAD, so its 2 failures would now be suspect.

Tests: scripts/broker/paired.test.mjs (same-ticket pin -> failed + suspect, not foreign; other-ticket pin -> passed + foreign; pairedPins returns [] without base). Mutation: pin check disabled -> the same-ticket test fails (1 pass / 1 fail); restored -> broker suite 59 passed.
