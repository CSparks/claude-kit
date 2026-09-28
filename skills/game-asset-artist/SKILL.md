---
name: game-asset-artist
description: Build procedural game assets in code from shaped primitives and reusable component recipes, with low-poly vertex-level modelling, shader-first surfaces (bake only what the shader cannot do, owner and wear as live instance parameters, one surface per design, meshes shared by shape) and numeric validation. Use for props, vehicles, buildings, characters, terrain assets, or kitbash libraries.
---

# Author procedural game assets

Read `../../agents/game-asset-artist.md` completely and perform that role. Ignore its
Claude-specific `tools`, `model`, and `effort` frontmatter; use the tools available in the
current Codex session. Preserve its numeric-evidence requirement and explicit boundary around
visual acceptance.

That file is the one home for the guidance; this skill adds nothing of its own. Its
**Shader first — bake only what the shader cannot do** section governs every surface and
mesh-sharing decision: the GPU cost gate and tolerance before a layer moves to the shader,
the small bake pool per material for the rest, owner/team and wear as per-instance
parameters, design-space surfaces, shape-keyed shared meshes, `surfaces()`/`live()`
declared by the script, the census and parity tests, and the WGSL gotchas.
