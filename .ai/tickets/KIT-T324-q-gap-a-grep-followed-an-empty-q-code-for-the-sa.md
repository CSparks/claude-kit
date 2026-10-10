---
id: KIT-T324
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T20:38:38Z
updated: 2026-10-04T20:38:38Z
---

## Description
q: q code "rg_engine::{" --limit 0 2>&1  then  grep: soft limit

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-04 20:38] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-10-05 17:30] (comment) seen again in dirt-empire: q: q code "poly_tube" --lang rust 2>&1 then Grep: poly_tube|poly_sweep
- [2026-10-05 18:38] (comment) seen again in dirt-empire: q: q code 'pub const META' --lang rust --path rapid-game/rust/tools -C 6 2>&1 then Grep: pub const META
- [2026-10-05 18:39] (comment) seen again in dirt-empire: q: q code "struct ScriptPiece" 2>&1 then Grep: pub struct ScriptPiece
- [2026-10-05 23:59] (comment) seen again in dirt-empire: q: q code "pub fn|pub struct" --regex --path rapid-game/rust/core/rg-pathfind/src --lang rust then Grep: pub fn chunk_mesh|pub struct ChunkMeshParams|pub struct TriangleSurface|pub fn height\(
- [2026-10-06 04:18] (comment) seen again in dirt-empire: q: q code "derive_paths::*" 2>&1 then Grep: derive_paths::\*
- [2026-10-06 06:02] (comment) seen again in dirt-empire: q: q code "set_lint" --lang rust then Grep: geometry validation failed|fn set_lint|cull_interior|lint_enabled|declares\(ast, "
- [2026-10-06 08:58] (comment) seen again in dirt-empire: q: q code "pub fn pieces" --path crates/dirt-empire/src then grep: pub enum Prop\|derive\|pub fn stamp\|pub fn stamp_parts
- [2026-10-06 14:47] (comment) seen again in dirt-empire: q: q code "struct WearSlot" 2>&1 then grep: pub fn\|pub struct
- [2026-10-06 14:48] (comment) seen again in dirt-empire: q: q code "pub fn" --path rapid-game/rust/core/rg-rng then grep: pub mod\|^mod
- [2026-10-06 14:50] (comment) seen again in dirt-empire: q: q code "broker" --path D:/dev/dirt-empire/.ai/config.yml -C 5 then grep: broker
- [2026-10-06 14:54] (comment) seen again in dirt-empire: q: q code "wontfix|superseded|statuses:" --regex --path .ai/config.yml -C 2 then grep: ^statuses
- [2026-10-06 20:49] (comment) seen again in stiletto-2349: q: q code "fn .*determinism|fn .*fire_rhythm" --regex --path crates/sim/tests then grep: fire_rhythm
- [2026-10-06 21:33] (comment) seen again in stiletto-2349: q: q code "STAGE_NS\|stage_report\|staged" --path crates/sim 2>&1 then grep: staged!(
- [2026-10-07 01:36] (comment) seen again in stiletto-2349: q: q code "NoAutomaticBatching|SkinnedMesh" --lang rust --limit 10 then grep: NoAutomaticBatching
- [2026-10-07 03:28] (comment) seen again in stiletto-2349: q: q code "fn specialize_shadows" then Grep: pub fn specialize_shadows
- [2026-10-07 15:34] (comment) seen again in stiletto-2349: q: q code "held.push\|Held {" --lang rust 2>&1 then grep: pub held\|pub dormant\|pub relevance\|pub populated\|pub bandits
- [2026-10-07 18:00] (comment) seen again in stiletto-2349: q: q code "rg_screens|rg-screens" --lang rust --path src --path crates then grep: rg-screens
- [2026-10-07 18:02] (comment) seen again in stiletto-2349: q: q code "context.focused|\"focused\"" then grep: focused
- [2026-10-07 18:39] (comment) seen again in stiletto-2349: q: q code "light budget\|no light budget\|Headlights near" --path docs then grep: light
- [2026-10-07 19:17] (comment) seen again in stiletto-2349: q: q code "t870-drive-quiet" then grep: drive_probe\|drive-probe
- [2026-10-07 21:56] (comment) seen again in stiletto-2349: q: q code "sim.world.seed\|world\.seed\|\.world_seed()" --lang rust --path crates then grep: rg-rng\|rg_rng\|^sim\|^materials\|rg-graphics
- [2026-10-07 22:29] (comment) seen again in dirt-empire: q: q code "bale|Bale" --lang rust --path crates/dirt-empire/src/track -l 2>&1 then grep: bale
- [2026-10-07 22:29] (comment) seen again in dirt-empire: q: q code 'pub struct PhysicsWorld' --lang rust --path rapid-game/rust 2>&1 then grep: pub narrow_phase\|pub colliders\|pub bodies\|pub struct PhysicsWorld\|narrow_phase
- [2026-10-07 22:36] (comment) seen again in stiletto-2349: q: q code "signed_noise\|fn mask_at\|mask_at(" --path rapid-game/rust then Grep: signed_noise|fn mask_at|mask_at\(
- [2026-10-07 22:57] (comment) seen again in dirt-empire: q: q code "pub fn named" --lang rust --path rapid-game/rust -C 25 2>&1 then grep: pub fn named
- [2026-10-07 23:47] (comment) seen again in dirt-empire: q: q code "Profile::|RISE|rise_m|level_m" --regex --lang rust --path crates/dirt-empire/src/track/lanes/generate -C 1 2>&1 then grep: level_m\|Profile::
- [2026-10-08 00:31] (comment) seen again in dirt-empire: q: q code "LANE_WIDTH_M" --path crates/dirt-empire 2>&1 then grep: LANE_WIDTH_M\|^use
- [2026-10-08 01:43] (comment) seen again in dirt-empire: q: q code "PickupKind|prize \+=|fn collect_pickups" --regex --lang rust --path crates/dirt-empire/src -C 3 2>&1 then grep: fn collect_pickups
- [2026-10-08 03:35] (comment) seen again in dirt-empire: q: q code "BulkUploads|mesh_allowance|MeshAdmission|mesh_admission" --regex --lang rust --path crates/dirt-empire/src 2>&1 then grep: BulkUploads\|MeshAdmission\|mesh_allowance\|MESH_ALLOWANCE
- [2026-10-08 03:36] (comment) seen again in stiletto-2349: q: q code "elev_m" --path crates/sim/src/bandit 2>&1 then grep: pub fn \|fn \|elev_m\|flies
- [2026-10-08 03:46] (comment) seen again in rapid-game: q: q code "fn " --path "C:/Users/Chris Sparks/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/bevy_render-0.19.1/src/slab_all then Glob: bevy_*-0.19.1/src/**/*alloc*.rs
- [2026-10-08 03:46] (comment) seen again in rapid-game: q: q code "fn get_vertex_buffer_size" 2>&1 then grep: fn take_gpu_data\|fn get_vertex_buffer_size\|fn count_vertices\|fn get_index_buffer_bytes\|fn get_morph_targets\|MeshAcc
- [2026-10-08 04:01] (comment) seen again in dirt-empire: q: q code "PrimitiveTopology::|LineList|PointList|LineStrip|TriangleStrip" --regex --lang rust --path crates/dirt-empire/src -C 1 then grep: PrimitiveTopology\|LineList\|PointList\|LineStrip
- [2026-10-08 18:11] (comment) seen again in dirt-empire: q: q code "barrier" -i --lang rust --path crates -l 2>&1 then grep: barrier\|Barrier\|wall
- [2026-10-08 20:59] (comment) seen again in rapid-game: q: q code "rg-window" --kind config 2>&1 then grep: rg-window\|rg_window
- [2026-10-08 21:03] (comment) seen again in rapid-game: q: q code branch-guard --lang json,md,mjs 2>&1 then grep: branch-guard\|branch_guard
- [2026-10-09 20:04] (comment) seen again in dirt-empire: q: q code "pub const FOV" then Grep: fn compute_aabb|trait MeshAabb|pub struct ViewFrustum|pub struct Frustum|fn from_clip_from_world|fn intersects_obb
- [2026-10-10 05:51] (comment) seen again in dirt-empire: q: q code "pub struct WallLine" -C 12 then grep: pub struct Line\|^use
- [2026-10-10 14:46] (comment) seen again in dirt-empire: q: q code "last-run.log" --path rapid-game then grep: last-run
