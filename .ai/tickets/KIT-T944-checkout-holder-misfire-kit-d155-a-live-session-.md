---
id: KIT-T944
title: checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the fil
type: bug
status: todo
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:32:10Z
updated: 2026-11-10T19:18:35Z
---

## Description
checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the file is committed and a different session or agent edits it again, the new dirt is blamed on the first session and the edit is refused as 'another live session has uncommitted changes' (2026-11-10: groovegrid session da28715f vs the standing kit agent on hooks/lib/gate-protocol.mjs, whose only diff was the agent's own edit)

kit-bug-shape: cap:bug:checkout-holder-misfire-kit-d155-a-live-session-
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Landed 7337941, 1dfe4e8; tests: hooks/session-overlap.test.mjs (negative controls included); standing kit agent adcd3ffd
### comment #1 [2026-11-10 19:03] @claude
Residual repro 2026-11-10 (da28715f agent): 7337941/1dfe4e8 fix the committed-then-redirtied case, but (a) a claim absorbed by shell-writes (a shell call's mtime window) is on a file the holder never wrote and can be released only by a commit that the claim itself blocks (deadlock while the holder agent keeps beating), (b) ledger entries with no recorded head hold forever. Root of (a) fixed in the KIT-T953 work (shell-writes skips tool-written files). Recommend moving T944 back to todo.
### comment #2 [2026-11-10 22:46] @claude
Handoff a269f761f8741564a (session da28715f): Jobs: KIT-T953, KIT-T949 fixed and live in runtime adf9781 (371c2f1, 3018084, 85f02ec, fce4d2c), in review. KIT-T944 residuals (no-head claims never lapse; false claims releasable only by a blocked commit) fixed in the working tree, NOT committed. State: 7 files uncommitted, claimed by session 5b63523a's ledger: hooks/lib/live-claims.mjs (new), hooks/lib/tool-writes.mjs, hooks/lib/checkout-holder.mjs, hooks/commit-gate.mjs, hooks/holder-beat.mjs, hooks/dispatch-holder.mjs, hooks/claim-release.test.mjs (new). Tests green on tree: claim-release 15, claim-release-controls 3 (committed fce4d2c), session-overlap 29, holder-shell-attribution 6, commit-gate 42, dispatch-holder 20, hand-write-detect 69, shell-writes 11; mutation N1-N6 each fail a control. Next: commit the 7 paths by explicit path with [commit-foreign: KIT-T944 residual deadlock, files are this agent's own, maintainer approved] (the orchestrator relayed the maintainer's questionnaire approval; the auto-mode classifier denied my two commit attempts because the approval reached me through an agent message, so the maintainer's own message or a Bash permission rule is needed), or wait until 5b63523a's agent stops/idles 15 min and commit with no token; then npm run publish:runtime and report the sha; then set KIT-T944 review. Stale da28715f hand-write blames (scripts/broker/{queue-age,broker,ensure,handover,supervise}.mjs, handover.test.mjs, groovegrid src/ui/tracks/ModifiersPanel.h) are not cleared by any fix; re-save each through Edit/Write. Files: hooks/lib/live-claims.mjs, hooks/lib/tool-writes.mjs, hooks/claim-release.test.mjs, hooks/claim-release-controls.test.mjs.
### comment #3 [2026-11-11 04:04] @claude
Recurrence 2026-11-11: holder-beat refused a standing agent's second Edit of hooks/lib/restored-content.mjs; the only dirt was the agent's own 2-line edit, blamed on session da28715f (groovegrid). Same residual as Handoff a269f761 (claim on a file the holder never wrote); live-claims.mjs fix is still uncommitted in the tree.

## History
- [2026-11-10 17:32] (created) bug — checkout-holder misfire (KIT-D155): a live session's write ledger lists a file forever (path only, never cleared on commit), so when the fil
- [2026-11-10 17:32] (comment) seen again in claude-kit: checkout-holder misfire (KIT-D155): a live session write ledger lists a file forever, path only and never cleared on commit, so after it is committed another session or agent editing it is refused as another live session with uncommitted changes (2026-11-10 groovegrid da28715f vs the standing kit ag
- [2026-11-10 17:32] (asked again) 2026-11-10 — cap:bug:checkout-holder-misfire-kit-d155-a-live-session-
- [2026-11-10 17:41] (landed) 7337941 checkout-holder: a session's write ledger keeps when it last wrote each file; a file committed since that write is no lo
- [2026-11-10 17:48] (landed) 1dfe4e8 checkout-holder: the write ledger records the HEAD at each write and a file counts as committed only when a commit touch
- [2026-11-10 18:08] (status) todo → review
- [2026-11-10 19:03] (comment) @claude: Residual repro 2026-11-10 (da28715f agent): 7337941/1dfe4e8 fix the committed-then-redirtied case, but (a) a claim absor (full comment #1 in ## Notes)
- [2026-11-10 19:17] (landed) fce4d2c live-claims negative controls: a claim with a recorded write HEAD never lapses by time; an Edit chained onto dirty-origi
- [2026-11-10 19:18] (status) review → todo
- [2026-11-10 19:18] (comment) remaining after 3 landed commit(s): residuals: fix written in working tree (hooks/lib/live-claims.mjs: claim with no write HEAD lapses one holder window after first judged; claim released by content-hash proof of another session's clean-based Edit/Write; wired into commit-gate, holder-beat, dispatch-holder; tool-writes records the clean-based flag; checkout-holder noteLegacyClaims), tests hooks/claim-release.test.mjs 15 + claim-release-controls.test.mjs 3 (committed fce4d2c), mutation-checked. Uncommitted: 7 files claimed by 5b63523a's ledger (absorbed by its old-runtime shell calls); needs commit by explicit path.
- [2026-11-10 22:46] (comment) @claude: Handoff a269f761f8741564a (session da28715f): Jobs: KIT-T953, KIT-T949 fixed and live in runtime adf9781 (371c2f1, 30180 (full comment #2 in ## Notes)
- [2026-11-11 04:04] (comment) @claude: Recurrence 2026-11-11: holder-beat refused a standing agent's second Edit of hooks/lib/restored-content.mjs; the only di (full comment #3 in ## Notes)
