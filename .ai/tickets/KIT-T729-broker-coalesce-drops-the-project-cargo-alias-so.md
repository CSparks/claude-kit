---
id: KIT-T729
title: broker: coalesce drops the project cargo alias so a rapid-game job builds the Bevy stack in a second feature set (j-mvvcgf3d 836 s)
type: bug
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T19:36:12Z
updated: 2026-10-30T19:36:12Z
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

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T717, KIT-T649, KIT-T534

## History
- [2026-10-30 19:36] (created) bug — broker: coalesce drops the project cargo alias so a rapid-game job builds the Bevy stack in a second feature set (j-mvvcgf3d 836 s)
