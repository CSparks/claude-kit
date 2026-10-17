---
id: KIT-D097
title: A broker owns writes to ONE checkout directory and only the files whose change can fail a compilation; nothing locks or waits across directories
summary: per-directory broker scope, Rust build inputs only (docs, .ai, data files are written directly), no machine-wide push lock, no C++/CMake brokering
date: 2026-10-17
supersedes: KIT-D096
directive: true
enforced_by:
  - scripts/broker/scope-invariants.test.mjs
  - scripts/broker/push-race.test.mjs
  - scripts/broker/build-scope.test.mjs
  - scripts/broker/no-orphan.test.mjs
  - hooks/dispatch-broker.test.mjs
source: Chris 2026-10-17 (capture 2026-10-17-1752); KIT-T553
---

**Decision:**
- **A broker owns writes to one working directory.** Two rapid-game checkouts in separate directories, or two separate repos, do not share a lock, a queue or a wait. KIT-D096's "a submodule queue is shared by every checkout that pushes it" is withdrawn: each checkout's submodule lane is its own.
- **No cross-directory lock.** The machine-wide push lock keyed by remote URL (`scripts/broker/pushlock.mjs`, used at `land.mjs`) is removed. A push that loses a race with another checkout of the same remote is refused by the remote and takes the existing refused-push path (KIT-T319): fetch, rebase onto the new tip, re-run the gate and tests, push again.
- **Rust only.** A checkout is brokered only when it tracks a Cargo.toml. `broker.mjs` (the daemon) and `submit.mjs` refuse a `broker:` repo without one with a one-line message; the dispatch guard ignores it. C++/CMake (GrooveGrid) is not brokered.
- **Build inputs only.** The broker owns files whose change can fail a compilation: `*.rs` (build.rs included), `Cargo.toml`, `Cargo.lock`, `.cargo/config*`, `rust-toolchain*`, and `include!()` targets (Rust code). Docs, `.ai/`, scripts no build reads, and files only embedded as data (`include_str!`/`include_bytes!`, such as the `.rhai` scripts Chris hot-edits while daemons run) are written directly: never queued, never pause the daemon, never blocked by the dispatch guard. One definition: `scripts/broker/build-globs.mjs` plus `build-inputs.mjs` (the `include!()` targets), shared by the daemon's pause logic and the guard. A writer dispatch declares its paths with `[paths: a, b]`; all non-build admits it, none declared keeps the block and the message says how to declare. A dirty `Cargo.lock` still never pauses (patch.mjs journals it).
- **Lanes do not block each other inside a checkout.** A writer dispatch is blocked only by the live daemon of the lane that owns a build input it writes: a path under a submodule (rapid-game) belongs to that submodule's lane, every other path to the root lane. Rapid-game edits are never blocked by stiletto's root daemon, nor stiletto edits by a rapid-game lane, nor either by another checkout. A brief with no `[paths:]` is blocked by any live lane, and the message names which.
- **No commit is ever orphaned.** Checkouts need no coordination; the remote's refusal, the rebase and the git pin settle a race. The rule is that neither checkout loses the other's work: no broker module pushes with force, mirror, delete or a +refspec; a landing whose push cannot complete parks its commit on `refs/broker/undone/` and names the ref and sha in the result; a gitlink is never committed (a `--pin`, a linked job, a resumed landing) for a submodule commit that is not on the remote's main; a lane whose submodule tree is detached at commits on no branch pauses naming the sha instead of moving the tree.
- Everything else in KIT-D096 stands: one lane per submodule inside a checkout, no repo waits on another repo's jobs except a pin job on the exact sha it pins, claude-kit and Node repos are never brokered.

**Chris, verbatim (2026-10-17):**
- "that needs to be scoped per repo. Per directory. Two rapid games in separate directories doesn't count. Two separate repos doesn't count."
- "There's no reason to use a broker for anything other than rust right now either."
- "This is exclusively for anything that can break a [build] because of file changed. This is not include documentation or scripts in that same repo that have nothing to do with a binary build."
- "Rapid game edits should not be blocked unless they are in the same repo. This means rapid game edits and dirt empire should not affect rapid game edits in stiletto."
- "The git pin handles any conflicts there."
- "The only issue is just making sure that neither orphans commits from the other."
- "Don't just record those rules, make them true."

**Why:** commit bcfa61d implemented KIT-D096 "never across the board" and in the same commit added the machine-wide push lock, so two checkouts waited on each other. A recorded rule with no test drifts; each clause here has a test that fails when it is broken.

**Rejected:**
- Keeping the push lock as "only for submodules": it is a wait across directories, which the rule forbids; the remote's own refusal plus the rebase path is correct and already tested.
- Counting `include_str!`/`include_bytes!` targets (or cargo dep-info, which lists them) as build inputs: stiletto embeds about 135 `.rhai` files that way and their content cannot fail compilation, so a hot-edited script must never pause the queue.
- A per-machine opt-in for non-Cargo repos: no repo has shown a need.
