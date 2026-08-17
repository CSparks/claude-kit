---
name: rapid-game
title: rapid-game — game asset contract
detect:
  submodule: rapid-game
  paths:
    - rapid-game/rust
  cargo: rg-meshkit
---

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
