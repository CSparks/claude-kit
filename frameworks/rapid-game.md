---
name: rapid-game
title: rapid-game — framework contract (purpose, dependency rule, asset contract)
detect:
  submodule: rapid-game
  paths:
    - rapid-game/rust
  cargo: rg-meshkit
---

**Purpose — the fast lane.** `new-poc foo && cargo run` gives a running game with worldgen,
streaming, assets, physics, UI, save, tunables, screens, editor and audio present, with
ZERO library or version decisions made by the person typing it; a POC that graduates turns
on what is already there. When a game needs something not in the framework, it goes into
rapid-game FIRST, never into the game (the flywheel: every game's effort compounds into
the next start). The submodule pin is the safety — a consumer re-pins when it wants what
is upstream; nothing breaks when the framework moves. (ST-D057, 2026-08-19.)

**Dependency rule — adopt the primitives, own the compositions.** A concept a better-
maintained library directly replicates is that library; a concept it does NOT have — the
abstraction and integration of things games do often — is a framework crate and is
PROVIDED live on the current engine. Every adopted primitive enters through ONE `rg-*`
door (rg-prelude is the only path to `bevy`; likewise `rg-noise`, `rg-rng`, `rg-fx`,
`rg-physics`…): a game names only `rg-*` crates; `cargo deny check bans` refuses the rest.
No trait seams except physics. Bevy-coupled third-party crates are budgeted (~10); a Bevy
bump is one rapid-game ticket that moves the set together.
- **The ledger is `rapid-game/docs/CHOICES.toml`** (one row per concern: crate, tier,
  coupling, why, rejected + evidence, decided) and `docs/CRATES.md` is generated from it.
  **Settled stays settled:** a proposal to add or swap a crate for a concern already on the
  ledger cites its row and brings NEW evidence, or it is relitigation — cite the row and
  move on. Decisions about rapid-game live THERE, not in a consumer's `.ai/`.

**Asset contract.**
- **The EDITOR is the acceptance surface.** Chris judges assets there; in-game appearance
  is SECONDARY evidence. (Chris, 2026-08-17: "The asset configurable properties should
  NEVER be out of sync with the editor, because that's how I'm judging assets.")
- **Every configurable property on an asset MUST appear in the editor.** A dial that
  exists on an asset but not in the panel is a defect in the ASSET — it makes the asset
  unjudgeable. Adding a dial is NOT done until it renders in the editor.
- **The panel derives controls from the asset's own spec.** Any path that hand-copies a
  dial into the panel WILL drift; the hand-copy is the defect, not the symptom. A
  fixed-arity bridge between asset and panel IS that defect.
- **One asset, ONE implementation.** Two builders for the same asset family guarantee a
  dial lands on one and not the other (ST-T286: `loot/gem-*` and `deposit/crystal` were
  two cluster implementations; `fan` existed on only one, so the editor could not show it).
- **Build assets from COMPLEX SHAPES via `rg-meshkit`** — poly extrude/inset/bevel/loop
  cut, lathe, sweep, loft, solidify, booleans — producing ONE solid per asset. NEVER
  boring primitives jammed together, never interpenetrating boxes.
