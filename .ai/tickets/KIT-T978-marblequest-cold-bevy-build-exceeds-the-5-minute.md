---
id: KIT-T978
title: marblequest cold bevy build exceeds the 5-minute ceiling (KIT-D104): scoped cargo test -p marblequest --test overworld_golden --test framewo
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T649, KIT-T620]
files: []
supersedes:
superseded_by:
created: 2026-11-10T22:46:05Z
updated: 2026-11-10T22:46:05Z
---

## Description
marblequest cold bevy build exceeds the 5-minute ceiling (KIT-D104): scoped cargo test -p marblequest --test overworld_golden --test framework_conformance --test worldgen_manifest hit the 290 s cap with exit 124 while compiling bevy_render/bevy_ui; earlier builds took 3.5-15 min. Needs a warm target-dir, a broker route or a scoped prebuild so a scoped test finishes inside one foreground wait

kit-bug-shape: cap:bug:marblequest-cold-bevy-build-exceeds-the-5-minute
first seen in marblequest. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Diagnosis 2026-11-10 (fix agent). (1) Cause of the cold build: marblequest pin 4e32ce53 of rapid-game brought in rg-scene, which depends on rg-engine with feature diagnostic-names (rg-engine/Cargo.toml:46 = bevy/debug). cargo tree -e features,no-dev -i rg-engine shows rg-scene as a NORMAL dependency (via rg-chunk-stream-bevy and rg-screens), so bevy_render now builds with features debug, morph, multi_threaded, serialize, type_label_buffers. target/debug/.fingerprint holds bevy_render-5ef577f0 (Nov 9, no debug) and bevy_render-b534e5a7 (Nov 10, debug), likewise bevy_ui, bevy_pbr and bevy_core_pipeline twice. One pin move = one full Bevy stack rebuild. There is no second feature set between build and test (dev-deps do not add it) and no second framework copy (rapid-game/rust/target holds no debug dir). (2) Why it is slow: the root Cargo.toml profile.dev.package.* opt-level = 3 (rapid-game LESSONS L-B02, by design) builds all of Bevy at O3. File times in target/debug/deps: the Nov 9 stack took about 4 min from bevy_render to the test binaries; the Nov 10 rebuild was still compiling at 16:58 (about 9 min). So 4 to 9 min per feature-set change at -j16; later builds are warm. (3) Hazard: a framework crate that enables a Bevy feature unconditionally (here rg-scene via diagnostic-names) flips every consumer Bevy feature set once on its next pin; reverting it would force a second rebuild, so do not flip it back as a fix. (4) Route: marblequest has no broker block in .ai/config.yml (q code broker --path .ai/config.yml: none), so agents there run raw cargo under the 290 s cap with no queue, resume (KIT-T518) or build slot. Enrolling it gives the existing broker route (submit and end, resume from finished.log) with no new mechanism. Proposed block, dirt-empire shape, for the orchestrator to apply (marblequest .ai/config.yml is not kit scope): broker: target_dir D:/dev/marblequest/target; parallelism.jobs auto; land_gate affected; affected.check 'cargo check --offline --workspace --all-targets'; affected.test 'cargo test --offline'; affected.conformance 'cargo test --offline -p marblequest --test framework_conformance'. Left open: not fixed until marblequest is enrolled; scoped-build time not measured because another cargo/rustc was compiling in D:/dev/marblequest at 16:58. Related, not duplicated: KIT-T649, KIT-T620 (same ceiling, other repos).

## History
- [2026-11-10 22:46] (created) bug — marblequest cold bevy build exceeds the 5-minute ceiling (KIT-D104): scoped cargo test -p marblequest --test overworld_golden --test framewo
