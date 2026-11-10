---
id: KIT-T948
title: Security review 2026-11-10 of kit commit 65c1e14 (KIT-D155): hooks/lib/session-overlap.mjs treats a file as committed when git log -1 --form
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:43:10Z
updated: 2026-11-10T18:17:12Z
---

## Description
Security review 2026-11-10 of kit commit 65c1e14 (KIT-D155): hooks/lib/session-overlap.mjs treats a file as committed when git log -1 --format=%ct for it is >= floor(wroteAt/1000)*1000, so a commit in the same second as, or just before, the holder's write can release the hold (guard bypass, fail-open); committer time also ignores who committed. Suggested: record the file blob hash (git hash-object) or HEAD sha at write time and release only when HEAD's blob matches it or HEAD moved past the sha and the working tree no longer holds the written content; fail closed on ambiguity. Add a test for the same-second case plus a negative control.

kit-bug-shape: cap:bug:security-review-2026-11-10-of-kit-commit-65c1e14
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] a holder that committed one hunk of a file and left another dirty keeps its hold (needs the written content recorded after the edit lands; the ledger records HEAD before it)

## Plan
1.

## Notes
Landed 1dfe4e8; tests: hooks/session-overlap.test.mjs (same-second negative control) (negative controls included); standing kit agent adcd3ffd
### comment #1 [2026-11-10 19:21] @claude
Not touched this pass: session da28715f's kit agent has the holder-ledger redesign uncommitted in this checkout (hooks/lib/checkout-holder.mjs, hooks/lib/tool-writes.mjs, hooks/lib/live-claims.mjs, hooks/claim-release.test.mjs, hooks/commit-gate.mjs, hooks/dispatch-holder.mjs, hooks/holder-beat.mjs); its landed commit fce4d2c (KIT-T944) adds live-claims negative controls and covers the content-recorded-after-the-edit idea this ticket needs. Re-check the partial-commit criterion once those files are committed. Observed in this run: after any commit of a file, exactly ONE further Edit to it passes before the gate blames da28715f again (stale ledger, KIT-T944 residual); a file with N planned edits landed as N commits.

## History
- [2026-11-10 17:43] (created) bug — Security review 2026-11-10 of kit commit 65c1e14 (KIT-D155): hooks/lib/session-overlap.mjs treats a file as committed when git log -1 --form
- [2026-11-10 17:48] (landed) 1dfe4e8 checkout-holder: the write ledger records the HEAD at each write and a file counts as committed only when a commit touch
- [2026-11-10 18:08] (status) todo → review
- [2026-11-10 18:15] (comment) criterion added: a holder that committed one hunk of a file and left another dirty keeps its hold (needs the written content recorded after the edit lands; the ledger records HEAD before it)
- [2026-11-10 18:17] (status) review → todo
- [2026-11-10 18:17] (comment) remaining after 1 landed commit(s): a holder that committed one hunk and left another dirty keeps its hold (needs the written content recorded after the edit lands)
- [2026-11-10 19:21] (comment) @claude: Not touched this pass: session da28715f's kit agent has the holder-ledger redesign uncommitted in this checkout (hooks/l (full comment #1 in ## Notes)
