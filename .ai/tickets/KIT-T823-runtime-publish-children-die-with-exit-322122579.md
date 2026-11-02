---
id: KIT-T823
title: runtime-publish children die with exit 3221225794 (0xC0000142) at git archive/commit when the harness moves a command past 180 s to the back
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:33:04Z
updated: 2026-11-02T17:02:17Z
---

## Description
runtime-publish children die with exit 3221225794 (0xC0000142) at git archive/commit when the harness moves a command past 180 s to the background and strips its console

kit-bug-shape: cap:bug:runtime-publish-children-die-with-exit-322122579
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: published as runtime 6b1d621 (npm run publish:runtime at HEAD 6b1d621, 137 of 329 files green in 107 s wall at 8 workers, 2m53s total); fix commits 0f59f85 b5787a2 0302076; tests runtime-publish 31, runner 16, housekeeping 42, handback 36, dispatch-worker 28, successor-gate 16, control 4
### Handoff ae9f33fd30059ba64
- Jobs: none running. No background command, no publish lock. Last publish: runtime e769a0a (head d5524a4), reach-limited, green. Earlier full-suite publishes 7aebf88 and 5fd6ef7 (KIT_TEST_FULL=1, 330 files, about 12 min wall each).
- State: DONE and published. KIT-T823..T828 in review (runtime 6b1d621). KIT-T829 precheck --manifest-path fix d70d595 in review. KIT-T729 measurement note written (270 s was a one-time 13-crate warm-up, no defect; dirty-reason gap is KIT-T772). KIT-T830 handoff close (ack.mjs --handoff) in review, run for abda8e03945cd9b43 on DE-T254 and DE-T245. KIT-T834 orphan-shell verify (hooks/orphan-verify.mjs) in review; KIT-T837 SendMessage resume takes a handoff over (hooks/lib/reopened.mjs) in review; KIT-T838 broker status ALIVE/STALLED/DEAD line (scripts/broker/daemon-state.mjs) in review; KIT-T840 wait.mjs last stdout line names state and exit code in review. Side fixes in 0ab34ce: q-print.mjs prints (no results) beside a NOT searched note; lock-restore.test.mjs checks only Cargo.lock cleanliness; runner.test.mjs ignores KIT_TEST_FULL.
- Next: (1) KIT-T836 kit feature, t config: set a project .ai/config.yml key through a verb (low); today dirt-empire needs broker.affected.conformance: "cargo t -p dirt-empire --test framework_conformance" hand-added, landing check unverified. (2) Publish-over-5-minutes bug (coordinator hands it to a fresh agent): a publish reaching a foundational module (scripts/id-utils.mjs reached 273 files, broker.mjs 148) is refused at the 140 s budget because recorded per-file times in .cache/test-times.json are inflated, so it needs the full suite at about 12 min. Needs: re-measure inflated recorded per-file times with a staleness bound; shard the full-suite publish across cores with a work queue; two-phase publish for foundational changes. (3) Reconciler observation: deferred foreign tests re-run only when the lane is idle (recheckDeferred in queue.mjs), by design. (4) KIT-T834 unverifiable rows silent 2 h are presumed dead (documented in orphan-verify.mjs). Other writer has uncommitted ticket-store edits (T816, T832, ROADMAP, INDEX); do not stage them.
- Files: scripts/broker/precheck-scope.mjs scripts/broker/precheck.mjs scripts/broker/handoff-close.mjs scripts/broker/ack.mjs hooks/lib/successor.mjs hooks/lib/handback.mjs hooks/lib/reopened.mjs hooks/resume-check.mjs hooks/orphan-verify.mjs hooks/orphan-shells.mjs hooks/flush.mjs scripts/broker/daemon-state.mjs scripts/broker/broker.mjs scripts/broker/deferred.mjs scripts/broker/wait.mjs scripts/q-print.mjs scripts/runtime-publish.mjs scripts/test-runner/select.mjs

## History
- [2026-11-02 16:33] (created) bug — runtime-publish children die with exit 3221225794 (0xC0000142) at git archive/commit when the harness moves a command past 180 s to the back
- [2026-11-02 16:42] (landed) 0f59f85 Publish fits the foreground window and never defers what it gates on: windowsHide children, workers scale to cores, --re
- [2026-11-02 17:02] (status) todo → review
- [2026-11-02 17:02] (landed) ca1b44d KIT-T823..T828 to review after runtime 6b1d621 published, 137 files green [no-test: ticket store only] (implements KIT-T
