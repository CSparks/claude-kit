---
id: KIT-T1010
title: hand-write-detect (source-shell-write, KIT-T706) blames a read-only Bash call for source files another writer changed during it: with three
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T04:11:31Z
updated: 2026-11-11T04:53:12Z
---

## Description
hand-write-detect (source-shell-write, KIT-T706) blames a read-only Bash call for source files another writer changed during it: with three sanctioned writers in one checkout (MAR-D020), lane C's meshkit-check/node stats call was flagged for crates/marblequest/src/generation/decor/intent.rs, edited by the game-code lane, and told to re-save it; the detector diffs the whole tree around the call instead of attributing writes to the calling process/session

kit-bug-shape: cap:bug:hand-write-detect-source-shell-write-kit-t706-bl
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A changed file holding another writer's unconfirmed prediction of its exact content waits for the confirmation (30 s cap) and is then no shell call's, and no commit is refused for it
- [x] An Edit nothing confirms, and a shell rewrite to other content, still flag the call and refuse the commit

## Plan
1.

## History
- [2026-11-11 04:11] (created) bug — hand-write-detect (source-shell-write, KIT-T706) blames a read-only Bash call for source files another writer changed during it: with three
- [2026-11-11 04:46] (landed) 5cc1d37 hand-write-detect waits for a lagging Edit confirmation before blaming a shell call for the file (a pre-write prediction
- [2026-11-11 04:49] (comment) @claude: Cause (ledger read at the incident, intent.rs entries of the game lane): pre-write recorded its prediction at 04:11:03.8 (full comment #1 in ## Notes)
### comment #1 [2026-11-11 04:49] @claude
Cause (ledger read at the incident, intent.rs entries of the game lane): pre-write recorded its prediction at 04:11:03.8, the recorder confirmed 6.6 s later (04:11:10.4); the model-author call began between the two, the Edit landed inside it, and hand-write-detect ran before the confirmation existed, so the unconfirmed prediction (no slack by KIT-T949 design) excused nothing. The hash rule is untouched. Fix 5cc1d37: lib/settle-writes.mjs, a changed file holding another writer's unconfirmed prediction of its exact content (made at most 30 s before the call) waits up to 8 s (CLAUDE_KIT_WRITE_SETTLE_MS) for the confirmation; unconfirmed after that it is still the call's. Tests: hooks/shell-attribution.test.mjs 33 passed (lagging confirmation spared; never-confirmed Edit and a shell rewrite to other content still flagged), hand-write-detect 69, hand-write-restore 29. Runtime publish refused: exported HEAD red on hooks/claim-release-controls.test.mjs (imports uncommitted hooks/lib/live-claims.mjs, the KIT-T944 residual of another session); current stays adf9781, which also lacks a2cb5a3. Same-class occurrences: KIT-T1001, KIT-T888.
- [2026-11-11 04:52] (landed) 19db931 hand-write-detect: the wait for a lagging Edit confirmation is 30 s (measured lag of 149 confirmed pairs: median 0.8 s,
- [2026-11-11 04:53] (comment) criterion added: A changed file holding another writer's unconfirmed prediction of its exact content waits for the confirmation (30 s cap) and is then no shell call's, and no commit is refused for it
- [2026-11-11 04:53] (comment) criterion added: An Edit nothing confirms, and a shell rewrite to other content, still flag the call and refuse the commit
- [2026-11-11 04:53] (comment) ticked: A changed file holding another writer's unconfirmed prediction of its exact content waits for the confirmation (30 s cap) and is then no shell call's, and no commit is refused for it
- [2026-11-11 04:53] (comment) ticked: An Edit nothing confirms, and a shell rewrite to other content, still flag the call and refuse the commit
- [2026-11-11 04:53] (comment) @claude: Fix commits 5cc1d37 and 19db931. Measured confirmation lag (toolwrites ledger, 149 pre-write/recorder pairs): median 0.8 (full comment #2 in ## Notes)
### comment #2 [2026-11-11 04:53] @claude
Fix commits 5cc1d37 and 19db931. Measured confirmation lag (toolwrites ledger, 149 pre-write/recorder pairs): median 0.8 s, p95 8.9 s, max 60 s, so the settle cap is 30 s (the wait ends the moment the confirmation lands). Inferred, not observed: the flagged call's start time, from ledger timestamps and the session hand-writes file mtime. Residual: the ledger update is a non-atomic read-modify-write capped at 300 entries (299 held at diagnosis); a lost entry still gives a false flag. Tests also assert the commit outcome: shell-attribution 35 passed.
- [2026-11-11 04:53] (status) todo → review
