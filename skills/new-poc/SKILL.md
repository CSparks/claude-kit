---
name: new-poc
description: Spin up a greenfield Rust game POC on the rapid-game framework — one command to a running Bevy app with the editor shell, hot-reload tunables, headless probe, and a wasm-clean web path. Use when the maintainer wants a new game POC or prototype started.
---

# new-poc — greenfield game POC on the framework

The user-level door to the rapid-game framework's template (KIT-D057). The machinery
lives in the framework repo (`CSparks/rapid-game`: `templates/new-poc/` +
`scripts/new-poc.mjs`, built under stiletto ST-T122); this skill drives it end to end.
The contract it delivers is ST-D011: bare `cargo run` runs the game — no flags to
remember.

## Steps

1. **Name + destination.** Kebab-case name; destination defaults to `D:\dev\<name>`
   (or the platform dev root). Confirm neither exists.
2. **Get the generator.** Use a local rapid-game checkout if one exists (any game's
   submodule works — read-only); otherwise clone `git@github.com:CSparks/rapid-game.git`
   to the scratchpad. Prefer `--reference <local checkout>` when cloning the submodule
   into the new project — it is dramatically faster.
3. **Generate:** `node <rapid-game>/scripts/new-poc.mjs <name> <dest> [--reference <local>]`
   — stamps the template, git-inits, adds the rapid-game submodule pinned at its
   current main.
4. **Verify (always, before handing over):**
   - bare `cargo run` from the repo root compiles and opens the window (ST-D011) —
     first build is minutes; `rust-toolchain.toml` may pull a newer rustc, that's
     by design (Bevy's rust-version).
   - `cargo run --bin probe` prints numbers and `PROBE OK`.
   - `cargo tree --duplicates` — one bevy, or stop and investigate.
5. **Remote:** create the GitHub repo under **CSparks** (the account of record) and
   push main. Never point anything at depixeled-chris.
6. **Kit adoption (offer, don't assume):** `node <kit>/scripts/init-project.mjs`
   inside the new repo wires `.ai/` + hooks if the maintainer wants the full workflow
   on this POC.

## Gotchas (learned building this — do not rediscover)

- The generated root `Cargo.toml` carries `[workspace] exclude = ["rapid-game"]`.
  LOAD-BEARING: cargo otherwise resolves the submodule crates' `workspace = true`
  against the outer root. Never remove it.
- The game crate names NO bevy version — Bevy comes through `rg-prelude`, and
  `rg_prelude::engine` carries Bevy's documented derive-macro alias workaround.
  Deriving modules need `use rg_prelude::engine::*;` (no per-game `engine.rs`).
- Hot-reload (`file_watcher`) is native-only by cfg — it is a hard compile_error on
  wasm. The template already handles this; keep the pattern when adding features.
- Web is a flag-flip, not a port: `trunk serve` via `preview.ps1`/`preview.sh`
  (WebGPU-only per the framework plan's guidance). The game must never REQUIRE the
  web path to run natively.
- F12 opens the editor shell (asset preview + Look tool); tunables are file-backed
  save-is-apply JSON under `assets/tunables/`.

## References

- Plan-of-record: `<rapid-game>/docs/FRAMEWORK_CONSOLIDATION_PLAN.md`
- Run-path contract: stiletto ST-D011 · Template provenance: stiletto ST-T122
