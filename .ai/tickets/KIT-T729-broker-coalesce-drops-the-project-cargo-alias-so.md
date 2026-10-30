---
id: KIT-T729
title: broker: coalesce drops the project cargo alias so a rapid-game job builds the Bevy stack in a second feature set (j-mvvcgf3d 836 s)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T19:36:12Z
updated: 2026-10-30T19:47:55Z
---

## Description
Broker job j-mvvcgf3d-39kum5 (dirt-empire broker, rapid-game lane, MAR-T034 check-only, passed) ran 836 s in the run phase (apply 12.6 s, gate 3.4 s, queue 20 s, build-slot wait 2 s per command). KIT-D104 ceiling breach; ticket KIT-T649 carries the auto-filed overrun reports.

## Measured
- Command 0, `cd rust && cargo t -p rg-graphics --test player_app` + `--test fullscreen_hotkey`: 402 s, 27 crates compiled (windows, gpu-allocator, wgpu-hal, wgpu, bevy_render, bevy_internal, bevy, leafwing-input-manager, rg-input, rg-graphics ...), tests 0.07 s.
- Command 1, `cd rust && cargo t -p rg-screens --lib pad_`: 429 s, 39 workspace crates compiled (no registry crates).
- The two earlier jobs of the lane built in 34 s and 48 s (warm).

## Root cause 1 (kit): coalesce.mjs drops the project alias
Command 0 is the two `cargo t` commands coalesced into `cargo nextest run --no-fail-fast -p rg-graphics --test ...` (result `composed`: no `--workspace`, no `--features rg-engine/dynamic_linking`). rapid-game's `t` alias is `nextest run --workspace --features rg-engine/dynamic_linking`; the rewrite is another feature set (static Bevy), so cargo rebuilt the whole Windows/wgpu/Bevy stack once more in the shared target (402 s, 6 min of it Bevy). Command 1 is not coalesced, keeps the alias, and found the Bevy stack warm. rapid-game/rust/.cargo/config.toml warns that mixing plain cargo test with `cargo t` pays a rebuild per switch. KIT-T534 is the same family (alias/feature-set flip between runs).

## Root cause 2 (patch, not the kit): the change rebuilds 39 workspace crates once
rg-graphics and rg-screens take rg-input[gamepad] as a normal dependency, so rg-input's unified feature set changes under `--workspace` and every dependent recompiles (command 1, 429 s). That cost is inherent to the first run of such a patch; later jobs on the new feature set are warm.

## Root cause 3 (kit): the submodule precheck has never run
All 16 rapid-game precheck logs in the dirt-empire broker (lanes/rapid-game/precheck-j-*.log) hold the same line, `error: cannot specify features for packages outside of workspace`. precheck.mjs runs the superproject's `affected.check` (`--features dirt-empire/tools`) in the submodule's tree root, where cargo finds the superproject workspace by walking up. The precheck fails open, so every rapid-game job queued unchecked and `precheck-rapid-game.cold` never cleared.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A merged cargo test keeps the project alias of its commands (coalesce-alias.test.mjs, 3 tests; they fail on the old coalesce.mjs)
- [x] A submodule repo is prechecked by a narrow check run from the job's `cd` directory, without the superproject features or whole-workspace stage (precheck-submodule.test.mjs, 4 tests)
- [ ] Next rapid-game job with a feature-graph change: command 0 shows `--workspace --features rg-engine/dynamic_linking` in `composed` and compiles no Bevy crate that command 1 would find warm
- [x] A -p crate that cannot reach the alias's --features pkg/feat builds alone, not with --workspace behind it (alias-closure.test.mjs, 3 tests)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T717, KIT-T649, KIT-T534
fixed_commit 95cc7e1, runtime 95cc7e1 published. Tests: coalesce-alias 3 (fail on old coalesce.mjs), precheck-submodule 4, coalesce 12, alias+scope+precheck 33 passed. Residual: the 39-crate rebuild from rg-input[gamepad] (429 s) is inherent to the patch's first run and still exceeds 5 min once; criterion 3 needs the next rapid-game feature-graph job. A daemon started before the publish keeps the old coalesce until restarted. train-gate.test.mjs hangs on baseline: KIT-T730.
Second breach, train-j-mvvhq5a6-mnekzi (lane rapid-game, 2 patches): command 'cd rust && cargo t -p rg-ui --lib screens::' ran 396+ s. Not contention (CPU load 27%, no cargo lock line in the log): the alias expansion is --workspace --features rg-engine/dynamic_linking -E package(rg-ui), so cargo built the lib unit tests of every workspace library behind the patched rg-ui (rg-input, rg-ui-bevy, rg-editor-kit, three tool editors, rg-graphics, rg-relevance-bevy, rg-material-book, rg-screens ...) in a serial Bevy-heavy chain to run rg-ui's tests only. rg-ui does not depend on rg-engine, so the feature cannot change its build. Fix: alias.mjs expands such a command as plain -p <crate> (no --workspace, no --features) when no named crate reaches the feature's package in Cargo.lock. The queue wait of 8 min is the machine build slot (KIT-D105), unchanged.

## History
- [2026-10-30 19:36] (created) bug — broker: coalesce drops the project cargo alias so a rapid-game job builds the Bevy stack in a second feature set (j-mvvcgf3d 836 s)
- [2026-10-30 19:42] (landed) 95cc7e1 broker: a merged cargo test keeps the project alias (no second feature-set Bevy build); a submodule repo is prechecked b
- [2026-10-30 19:47] (status) todo → review
- [2026-10-30 21:58] (comment) criterion added: A -p crate that cannot reach the alias's --features pkg/feat builds alone, not with --workspace behind it (alias-closure.test.mjs, 3 tests)
- [2026-10-30 21:59] (comment) ticked: A -p crate that cannot reach the alias's --features pkg/feat builds alone, not with --workspace behind it (alias-closure.test.mjs, 3 tests)
