---
id: KIT-T829
title: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
type: bug
status: review
priority: critical
asked: 2
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T16:41:34Z
updated: 2026-11-02T17:06:15Z
---

## Description
broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superproject 'cargo check -p rg-shader-kit --test X', where the submodule crate's dev-dependencies (rg-testkit, naga_oil) do not exist, so every framework integration test is refused as a compile error before queueing (DE-T245 jobs j-mvzhhkhz-82ybgy, j-mvzhjpn3-7wx2ki). The precheck should check such a command in the manifest's own workspace.

kit-bug-shape: cap:bug:broker-submit-precheck-a-test-cargo-test-manifes
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix: scripts/broker/precheck-scope.mjs narrowChecks groups the job's cargo commands by workspace; a --manifest-path command (also --manifest-path=) gets its own cargo check that repeats the manifest and drops the superproject --features, so the framework crate resolves with its own dev-dependencies (rg-testkit, naga_oil); the repo-level check still follows. precheck.mjs runs every stage. Tests: precheck-scope 6 (2 new), precheck-manifest 2 new (stage commands + negative control), precheck-submodule 4, precheck 6, guards, missing-log: 37 passed; mutation (manifest ignored) fails 4. Duplicates: q fts finds only this ticket; the second cap filing was folded in by cap (asked: 2), nothing else to close. Same gap for a non-submodule 'cd <dir> &&' prefix is left as is (precheck-submodule control locks it).
### Handoff ae9f33fd30059ba64
- Jobs: none running. No background command, no publish lock. Last publish: runtime e769a0a (head d5524a4), reach-limited, green. Earlier full-suite publishes 7aebf88 and 5fd6ef7 (KIT_TEST_FULL=1, 330 files, about 12 min wall each).
- State: DONE and published. KIT-T823..T828 in review (runtime 6b1d621). KIT-T829 precheck --manifest-path fix d70d595 in review. KIT-T729 measurement note written (270 s was a one-time 13-crate warm-up, no defect; dirty-reason gap is KIT-T772). KIT-T830 handoff close (ack.mjs --handoff) in review, run for abda8e03945cd9b43 on DE-T254 and DE-T245. KIT-T834 orphan-shell verify (hooks/orphan-verify.mjs) in review; KIT-T837 SendMessage resume takes a handoff over (hooks/lib/reopened.mjs) in review; KIT-T838 broker status ALIVE/STALLED/DEAD line (scripts/broker/daemon-state.mjs) in review; KIT-T840 wait.mjs last stdout line names state and exit code in review. Side fixes in 0ab34ce: q-print.mjs prints (no results) beside a NOT searched note; lock-restore.test.mjs checks only Cargo.lock cleanliness; runner.test.mjs ignores KIT_TEST_FULL.
- Next: (1) KIT-T836 kit feature, t config: set a project .ai/config.yml key through a verb (low); today dirt-empire needs broker.affected.conformance: "cargo t -p dirt-empire --test framework_conformance" hand-added, landing check unverified. (2) Publish-over-5-minutes bug (coordinator hands it to a fresh agent): a publish reaching a foundational module (scripts/id-utils.mjs reached 273 files, broker.mjs 148) is refused at the 140 s budget because recorded per-file times in .cache/test-times.json are inflated, so it needs the full suite at about 12 min. Needs: re-measure inflated recorded per-file times with a staleness bound; shard the full-suite publish across cores with a work queue; two-phase publish for foundational changes. (3) Reconciler observation: deferred foreign tests re-run only when the lane is idle (recheckDeferred in queue.mjs), by design. (4) KIT-T834 unverifiable rows silent 2 h are presumed dead (documented in orphan-verify.mjs). Other writer has uncommitted ticket-store edits (T816, T832, ROADMAP, INDEX); do not stage them.
- Files: scripts/broker/precheck-scope.mjs scripts/broker/precheck.mjs scripts/broker/handoff-close.mjs scripts/broker/ack.mjs hooks/lib/successor.mjs hooks/lib/handback.mjs hooks/lib/reopened.mjs hooks/resume-check.mjs hooks/orphan-verify.mjs hooks/orphan-shells.mjs hooks/flush.mjs scripts/broker/daemon-state.mjs scripts/broker/broker.mjs scripts/broker/deferred.mjs scripts/broker/wait.mjs scripts/q-print.mjs scripts/runtime-publish.mjs scripts/test-runner/select.mjs

## History
- [2026-11-02 16:41] (created) bug — broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superp
- [2026-11-02 16:41] (comment) seen again in dirt-empire: broker submit precheck: a --test 'cargo test --manifest-path rapid-game/rust/Cargo.toml -p rg-shader-kit --test X' is folded into the superproject 'cargo check -p rg-shader-kit --test X', where the submodule crate's dev-dependencies (rg-testkit, naga_oil) do not exist, so every framework integration
- [2026-11-02 16:41] (asked again) 2026-11-02 — cap:bug:broker-submit-precheck-a-test-cargo-test-manifes
- [2026-11-02 17:06] (landed) d70d595 Broker precheck: a --manifest-path cargo test is checked in its own workspace with its dev-dependencies, not folded into
- [2026-11-02 17:06] (status) todo → review
- [2026-11-02 17:11] (landed) 00e36d4 KIT-T829 to review [no-test: ticket store only] (implements KIT-T829)
- [2026-11-02 17:15] (landed) 5619d74 KIT-T829 ticket sync [no-test: ticket store only] (implements KIT-T829)
