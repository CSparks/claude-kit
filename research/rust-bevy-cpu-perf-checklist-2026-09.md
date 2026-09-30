# Rust / Bevy CPU performance checklist (2026-09)

Audit checklist for Bevy game workspaces (fixed-tick sim, thousands of units, procgen,
serial render thread). Extends the five video principles (needless collect, no hot-loop
alloc, `entry()`, rayon fold/reduce, `swap_remove`) recorded in stiletto ST-N017.
Research: Sonnet 5.5 web pass, 2026-09-30. **UNSOURCED** rows are model knowledge not
fetched in that pass: profile before coding them.

Sources: PB = https://nnethercote.github.io/perf-book/ (heap-allocations, build-configuration,
hashing, bounds-checks, type-sizes); BV-setup = https://bevy.org/learn/quick-start/getting-started/setup/;
BV-prof = https://github.com/bevyengine/bevy/blob/main/docs/profiling.md;
BV-storage / BV-cmd = docs.rs bevy `StorageType`, `Commands`.

| # | Rule | Detect | Payoff | Source |
|---|---|---|---|---|
| 1 | Spatial broadphase instead of O(N^2) pair scans; keep cell arrays across ticks | nested unit loops; superlinear scaling in a trace | 10x+ at 2000 units | UNSOURCED |
| 2 | Reuse buffers (`clear`, `Local<Vec>`, `with_capacity`) | dhat, allocs per tick; `Vec::new` in systems; clippy `same_item_push`, `vec_init_then_push`, `needless_collect` | 5-30% | PB |
| 3 | No global `Mutex`/`RwLock` cache on a hot path: thread-local memo or prepass | `static .*Mutex`, `LazyLock<Mutex`; park/futex time; idle rayon workers | can serialise a parallel path | UNSOURCED |
| 4 | Dev profile: `opt-level=1`, deps `opt-level=3` | Cargo.toml | several x in dev | BV-setup |
| 5 | Release: `codegen-units=1`, LTO thin/fat, maybe `panic=abort` | Cargo.toml | LTO 10-20%+ | PB, BV-setup |
| 6 | Change detection: `Changed`/`Added` filters, `set_if_neq`, no needless `DerefMut` | conditional `&mut` writes; systems running without input change | medium, cascades to extract/upload | UNSOURCED |
| 7 | No per-tick insert/remove of markers; `SparseSet` for toggling components; batch spawns | `commands.insert/remove` in tick systems; ApplyDeferred time | medium-high | BV-storage, BV-cmd (version-sensitive) |
| 8 | No per-frame `Assets::get_mut` / mesh rewrites when unchanged | `get_mut` in Update; render extract/upload time | large on serial render thread | UNSOURCED (version-sensitive) |
| 9 | Rayon only above a measured cutoff; `with_min_len`, no nested `par_iter` | scheduler frames; parallel slower at small N | avoids regressions | UNSOURCED |
| 10 | Fast hasher (FxHash, nohash) for integer/entity/grid keys | `std::collections::HashMap` in hot maps; clippy `disallowed_types` | large on hash-heavy code | PB |
| 11 | Hot/cold split; tight hot components | `size_of` of hot components; `top-type-sizes` | medium | PB, BV-storage |
| 12 | Small types: box big enum variants, `u32` indices, >128 B is a memcpy | clippy `large_enum_variant`, `large_types_passed_by_value` | small-medium | PB |
| 13 | Bounds-check elision: iterate or slice first | `cargo asm`; `[i]` in inner loops | unlocks SIMD | PB |
| 14 | Enum or generic dispatch over `Box<dyn>` in per-unit loops | clippy `box_collection`, `vec_box` | small-medium | UNSOURCED |
| 15 | SmallVec/ArrayVec/Cow; `write!` into a reused String; no `format!` in loops | clippy `format_push_string`, `useless_format` | small-medium | PB |
| 16 | Bump/arena for per-tick or per-build scratch | many short-lived allocs from one site | medium in procgen | UNSOURCED |
| 17 | mimalloc/jemalloc | malloc/free time | substantial | PB (check Windows/wasm) |
| 18 | `length_squared`/`distance_squared`; no sqrt/trig per pair; f32 glam | `.length()`, `.sqrt()`, `as f64` in loops | medium in pair loops | UNSOURCED |
| 19 | `target-cpu` fixed baseline (x86-64-v3), never `native` for shipped builds | `.cargo/config.toml` | small-medium | PB |
| 20 | PGO | build process | 10%+, high effort | PB |
| 21 | Pad per-thread accumulators (`CachePadded`) | scaling stalls in fold | niche | UNSOURCED |
| 22 | Batch channel messages; crossbeam/flume | channel frames | small-medium | UNSOURCED |
| 23 | Memoise pure deterministic builds, without a global lock | same call, same args, repeated | workload-dependent | UNSOURCED |

## Measurement
- Bevy `trace` feature; `trace_tracy` for live capture and allocation tracking; chrome
  trace into Perfetto (BV-prof). dhat for allocations; assert allocs-per-tick in a test.
- criterion / divan / samply: unsourced in this pass.

## Determinism
Order-sensitive sim paths keep their order: #9 (unordered reductions), #10 (never iterate a
HashMap in the sim), #14 (reordering).
