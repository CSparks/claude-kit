---
id: KIT-T1122
title: KIT-T1121 dispatch: a subagent filed KIT-T1121 (the source-shell and query gates missed grep, tail, head, cut, cat, ls and wc used in Bash p
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T07:03:53Z
updated: 2026-11-13T13:50:42Z
---

## Description
KIT-T1121 dispatch: a subagent filed KIT-T1121 (the source-shell and query gates missed grep, tail, head, cut, cat, ls and wc used in Bash pipelines on source and command output by an implementer, against its brief). Also needed by road-generator's orchestrator: the broker for a repo with NO git remote (road-generator, by decision RDG-D001): the kit agent's config snippet names remote: origin; how the broker lands and pins with no remote is unknown. Parallel hand writers in one checkout broke each other's builds for long stretches on 2026-11-13 (a writer mid-edit leaves a crate not compiling for every other writer whose build depends on it): the broker's patch queue is the answer, so the road demo needs it running.

kit-bug-shape: cap:bug:kit-t1121-dispatch-a-subagent-filed-kit-t1121-th
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
T1122 (broker, repo with no remote) landed b27156f, runtime published b27156f. Cause: normalizeRepo made every repo's remote 'origin'; sync-push fetched (failed, ignored) then pushed (failed), and land.mjs undid the commit, so a remote-less root could never land. Fix: `remote: none` (no-remote.mjs) -> syncPush returns ok at once (no fetch, rebase, push); a submodule lane with a remote pushes as before; its pin lands in the remote-less root as a local commit (repinSuperproject, or a root --pin job). Absent remote still = origin. Config refuses remote: none on a submodule lane and with pre_push: true. Tests: scripts/broker/no-remote.test.mjs 6 passed (landing with zero git remotes; origin control fails and leaves no commit; lane push + local pin; root --pin job; unpushed framework sha still refused; config); land-sync, land, pin, push-race 29 passed.

ROAD-GENERATOR broker section (add to D:\dev\road-generator\.ai\config.yml; nothing else needed):
broker:
  repos:
    - { name: road-generator, path: ., main: main, remote: none }
    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }
Defaults that apply (checked by normalizeBroker on exactly this text): land_gate check (compile check + only the --test commands a patch names), patch_check touched, verify_default none, attribute_failures/recheck_deferred off, precheck on, check_tree on, target_dir <root>/target, jobs auto, untracked_blocks derived from the tracked crates (blocks.mjs; the submodule's own lane covers rapid-game), affected.check cargo check --workspace --all-targets, auto_pin false (KIT-D141 session-start pin or an explicit pin job moves the gitlink; auto_pin true would pin on every rapid-game landing from any checkout), pre_push off (the submodule git dir has no pre-push hook installed). No suite, nightly or land_gate keys: a due full suite is only recorded AWAITING APPROVAL and never runs without `broker.mjs approve-suite`.
The repo has no `cargo t` alias: name tests as `cargo test -p <crate> ...`.

START (sealed runtime b27156f; `current` points at it; the home path has a space, keep the quotes):
 node "C:/Users/Chris Sparks/.claude/claude-kit-runtime/b27156f/scripts/broker/broker.mjs" --root D:/dev/road-generator --idle-exit 60     (background Bash; a second start while one is live exits 1)
 The first submit.mjs also starts the root daemon itself (launch.mjs, outside the caller's shell), and the root daemon or a rapid-game submit starts the rapid-game lane daemon when that lane has a queued job. Explicit lane: same command plus --lane rapid-game.
STATUS: node "C:/Users/Chris Sparks/.claude/claude-kit-runtime/b27156f/scripts/broker/broker.mjs" status --root D:/dev/road-generator   (every lane: daemon, queue, pause, hold, health). Also: ... broker.mjs pause|resume --root D:/dev/road-generator ; node ".../scripts/broker/watch.mjs" --root D:/dev/road-generator --for any (orchestrator only).
NOTE: the live tree now holds hand edits (Cargo.lock, crates/rdg-scenery, crates/rdg-world/src/towns.rs, rapid-game): a job that touches those paths, and any modified tracked *.rs / Cargo.toml / Cargo.lock, pauses the queue as `dirty` until they are committed or reverted. Commit them first; after that every writer dispatches as patch-worker (a writer-capable dispatch into a broker-owned lane is blocked: broker-owned-tree).

PATCH-WORKER DISPATCH (Agent call): subagent_type claude-kit:patch-worker, model "sonnet", description "[Sonnet 5.5] <label>"; prompt:
(b) demo edit:
 [job: fix] [paths: crates/rdg-world/src/towns.rs, crates/road-generator/assets/roads/towns.ron]
 Ticket RDG-Txxx: <acceptance criteria>. Load the patch-worker skill. Broker live on D:/dev/road-generator. kit = C:/Users/Chris Sparks/.claude/claude-kit-runtime/b27156f. Submit check-only first: node "<kit>/scripts/broker/submit.mjs" --root D:/dev/road-generator --ticket RDG-Txxx --title "<title>" --test "cargo test -p rdg-world --lib towns" < envelope; read the result with wait.mjs once; then resubmit the same envelope with --land. The repo has no remote: a landing is a local commit on main. Paths are relative to the repo root. Never edit the tree, never run cargo.
(a) framework edit (paths relative to the rapid-game submodule for the lane job):
 [job: fix] [paths: rapid-game/rust/roads/rg-roadworks/src/relay.rs]
 Ticket RDG-Txxx: ... Same preamble. Step 1: node "<kit>/scripts/broker/submit.mjs" --root D:/dev/road-generator --repo rapid-game --ticket RDG-Txxx --title "<title>" --test "cargo test -p rg-roadworks --lib relay" < envelope (paths relative to rapid-game/, e.g. rust/roads/rg-roadworks/src/relay.rs); check-only first, then --land: it pushes to github rapid-game origin main and the result carries landed.sha. Step 2 (the pin, a root-lane job): node "<kit>/scripts/broker/submit.mjs" --root D:/dev/road-generator --ticket RDG-Txxx --title "pin rapid-game <sha10>" --pin rapid-game=<landed.sha> --no-patch --test "cargo check --workspace --all-targets" --land. If the framework change needs demo edits, skip the bare pin and land the demo envelope with --pin rapid-game=<landed.sha> --land (the gitlink and the demo files are ONE commit, built and checked with the framework at that sha). Until the pin lands, broker jobs build the demo at the recorded gitlink (implicitPins), so the demo keeps compiling; only the live rapid-game checkout sits ahead of the gitlink (a hand build there sees the new framework).

QUESTION: does the compile check catch a patch that touches files a previous patch left not compiling? A patch is applied in the broker's check tree (a worktree of the live HEAD: landed code only, never another writer's half-edit or a hand edit) and compile-checked with `cargo check --workspace --all-targets` narrowed to -p <each touched package> per workspace (compileChecks, landgate.mjs; dependencies of those packages compile, DEPENDENTS DO NOT; a .rs/Cargo.toml outside every crate falls back to the whole workspace check). So: YES for the touched packages: a patch over a package that HEAD cannot compile fails there with the rustc error and lands nothing. NO for untouched dependents: a landed patch that changed a public item of crate A passes if A compiles, even when untouched crate B (depends on A) no longer does; B's break surfaces when the next patch touches B, or never until a build. Across the submodule boundary the same: a rapid-game lane landing compile-checks only the rg crates it touched; the demo is first built against it by the pin job (so give the pin job the --test cargo check --workspace above). For API changes, `patch_check: workspace` (whole-workspace compile check, still no test, within KIT-D162/D163) closes the dependents gap in the root lane, but is one global key: it would also make every rapid-game lane landing check the whole framework workspace, so the default `touched` is recommended and the cost left to the orchestrator.

## History
- [2026-11-13 07:03] (created) bug — KIT-T1121 dispatch: a subagent filed KIT-T1121 (the source-shell and query gates missed grep, tail, head, cut, cat, ls and wc used in Bash p
- [2026-11-13 13:47] (landed) b27156f broker: remote: none lands a repo with no git remote as a local commit; a submodule lane pins into it (implements KIT-T1
- [2026-11-13 13:50] (comment) @claude: fixed b27156f (pushed), runtime b27156f; scripts/broker/no-remote.test.mjs 6 passed, land-sync/land/pin/push-race 29 passed; road-generator section and commands in Notes
- [2026-11-13 13:50] (status) todo → review
- [2026-11-13 13:56] (comment) @claude: runtime republished at 991e94c (also holds b27156f's broker); the b27156f path in Notes stays valid
