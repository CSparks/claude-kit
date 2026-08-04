# Worktree isolation for Rust agents pays a full cold build — share the target cache

Lived (stiletto, 2026-08-04): a game-asset-artist dispatched with `isolation: worktree`
into a Bevy workspace went 30+ min with no visible output — Chris asked "what the fuck
is going on." Diagnosis: the fresh worktree has no `target/`, so the agent paid a cold
build of the entire Bevy graph (rustc at 3.3 GB RSS), concurrently with another agent
compiling in the main tree. Tokens were in family (230K vs 200-313K siblings); ALL the
anomaly was wall-clock + silent buffer (multi-minute cargo calls stream no turns).

## Proposed fixes (kit-level)
1. Dispatch guidance in the ladder/agent docs: for compile-heavy Rust repos, worktree
   dispatch must set `CARGO_TARGET_DIR` to a shared per-repo cache (or pre-warm by
   copying target/) — isolation of SOURCE, not of build artifacts. Caveat: cargo locks
   the target dir during builds, so two agents sharing one cache serialize their
   compiles — still usually faster than a cold graph build.
2. Orient/dispatch hook: when spawning a worktree agent in a repo with a >1 GB target/
   dir, warn about the cold-build cost at dispatch time.
3. Progress visibility: a long-running agent whose last tool call is `cargo <build|
   check|test>` should be reported as "compiling" in the task list, not silent.
