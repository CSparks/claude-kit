---
id: KIT-T276
title: Decide the future of the broker-worker skill and build broker under KIT-D074: its workers edit in worktrees on lane branches, which branch-guard and dispatch-guard now block
type: tech-debt
status: todo
priority: medium
milestone:
labels: [dispatch, broker]
links: [KIT-D074, KIT-T270, KIT-D071]
files: [skills/broker-worker/SKILL.md, docs/BROKER.md, scripts/broker/]
supersedes:
superseded_by:
created: 2026-09-28T15:32:04Z
updated: 2026-09-28T15:32:04Z
---

## Description
The build broker (KIT-T270, `scripts/broker/`) and its `broker-worker` skill have workers
edit in `git worktree add … -b lane/<ticket>` checkouts dispatched with `isolation: worktree`.
KIT-D074 (one checkout on main, 2026-09-28) makes `branch-guard` block the worktree add and
lane branch, and `dispatch-guard` block every worktree dispatch in every project. The
maintainer has NOT retired the broker: the skill and scripts stay as they are until he
decides. Today they are unusable without `[maintainer-asked-worktree:]` /
`[maintainer-asked-branch:]` escapes.

## Acceptance Criteria
- [ ] The maintainer's decision (retire, rework to a single-checkout model, or keep as an explicitly-asked exception) is recorded as a decision file.
- [ ] The skill, `docs/BROKER.md` and `scripts/broker/` match that decision; the kit suite passes.
- [x] L1 Pause rule (tracked-dirty + untracked_blocks), cargo t/b/r composition, wait 540 s, stiletto verify_default cargo t; test: untracked assets/x.glb runs, untracked crates/a/tests/x.rs pauses, cargo t -p x gets --no-fail-fast -j 3
- [x] L2 Envelope parser, submit dry-run on stdin (no branch), content-addressed apply, stale result, check-only restore journal
- [ ] L3 Gate phase reusing hooks/pre-write.mjs; patch over 600 lines -> gate, tree untouched
- [ ] L4 Path-only land, ticket required, push, submodule pin; lane code deleted (checkoutDetached/rebaseOnto/deleteBranch/removeWorktree/unmergedFiles, branch/worktree job fields)
- [ ] L5 patch-worker agent + skill, BROKER.md rewrite, dispatch-guard broker-owned-tree, pause/resume, orient lands/inflight, KIT-T271 rollout changes (no first start)

## Plan
1. Put the options to the maintainer in one questionnaire.

## History
- [2026-09-28 15:32] (created) tech-debt — Decide the future of the broker-worker skill and build broker under KIT-D074: its workers edit in worktrees on lane branches, which branch-guard and dispatch-guard now block
- [2026-10-02 17:19] (comment) @chris: Chris 2026-10-02: one-writer-per-checkout must be resolved — many agents should read and QUEUE patches/tests; one place  (full comment #1 in ## Notes)
### comment #1 [2026-10-02 17:19] @chris
Chris 2026-10-02: one-writer-per-checkout must be resolved — many agents should read and QUEUE patches/tests; one place applies, builds, tests and lands them serially. Direction = rework the broker to the single-checkout model (no worktrees). Design discussion open.
- [2026-10-02 17:19] (comment) @chris: Chris 2026-10-02: ONE agent writes and runs (applies patches, builds, tests, lands). All other agents read and queue pat (full comment #2 in ## Notes)
### comment #2 [2026-10-02 17:19] @chris
Chris 2026-10-02: ONE agent writes and runs (applies patches, builds, tests, lands). All other agents read and queue patches + tests; they never write in the tree or run builds. Reuse scripts/broker queue/results as the writer agent's inbox/outbox.
- [2026-10-02 17:37] (comment) @chris: Chris 2026-10-02 decided: (1) the broker DAEMON is the one writer (applies/builds/tests/lands; orchestrator handles stuc (full comment #3 in ## Notes)
### comment #3 [2026-10-02 17:37] @chris
Chris 2026-10-02 decided: (1) the broker DAEMON is the one writer (applies/builds/tests/lands; orchestrator handles stuck patches); (2) check-only runs may touch the live tree briefly, with broker pause/resume commands and in-flight patch shown at orient; (3) ship patch-workers read-only by tool list + prompt contract, then add a hard guard hook once the hook payload is shown to name the agent type; (4) build now, L0-L5 serial by one sonnet lane, stiletto rollout (KIT-T271) last. Design: analyst report 2026-10-02 (envelope search/replace patches via stdin, content-addressed apply, stale/gate/run phases, pause on tracked changes or untracked code only).
- [2026-10-02 17:38] (comment) criterion added: L1 Pause rule (tracked-dirty + untracked_blocks), cargo t/b/r composition, wait 540 s, stiletto verify_default cargo t; test: untracked assets/x.glb runs, untracked crates/a/tests/x.rs pauses, cargo t -p x gets --no-fail-fast -j 3
- [2026-10-02 17:38] (comment) criterion added: L2 Envelope parser, submit dry-run on stdin (no branch), content-addressed apply, stale result, check-only restore journal
- [2026-10-02 17:38] (comment) criterion added: L3 Gate phase reusing hooks/pre-write.mjs; patch over 600 lines -> gate, tree untouched
- [2026-10-02 17:38] (comment) criterion added: L4 Path-only land, ticket required, push, submodule pin; lane code deleted (checkoutDetached/rebaseOnto/deleteBranch/removeWorktree/unmergedFiles, branch/worktree job fields)
- [2026-10-02 17:38] (comment) criterion added: L5 patch-worker agent + skill, BROKER.md rewrite, dispatch-guard broker-owned-tree, pause/resume, orient lands/inflight, KIT-T271 rollout changes (no first start)
- [2026-10-02 17:43] (comment) ticked: L1 Pause rule (tracked-dirty + untracked_blocks), cargo t/b/r composition, wait 540 s, stiletto verify_default cargo t; test: untracked assets/x.glb runs, untracked crates/a/tests/x.rs pauses, cargo t -p x gets --no-fail-fast -j 3
- [2026-10-02 17:43] (comment) @chris: 2026-10-02 L1 landed: pause rule (tracked-dirty + untracked_blocks), cargo t/b/r composition, wait 540 s, stiletto verif (full comment #4 in ## Notes)
### comment #4 [2026-10-02 17:43] @chris
2026-10-02 L1 landed: pause rule (tracked-dirty + untracked_blocks), cargo t/b/r composition, wait 540 s, stiletto verify_default cargo t. broker tests 16 pass; npm runner 74 OK, 2 known failures (agent-pins, express)
- [2026-10-02 17:51] (comment) ticked: L2 Envelope parser, submit dry-run on stdin (no branch), content-addressed apply, stale result, check-only restore journal
- [2026-10-02 17:51] (comment) @chris: 2026-10-02 L2 landed: envelope parser, submit dry-run on stdin, content-addressed apply, stale results with commits sinc (full comment #5 in ## Notes)
### comment #5 [2026-10-02 17:51] @chris
2026-10-02 L2 landed: envelope parser, submit dry-run on stdin, content-addressed apply, stale results with commits since base, check-only restore journal + crash recovery, rustc/test diagnostics. broker tests 25 pass; npm runner 74 OK + 2 known failures. Deviation: --diff unified form deferred; --land rejected at submit until L4
