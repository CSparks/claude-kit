# Reference-selection failure: port anchored on the superseded TS path, native Rust crate dismissed unread

2026-08-12, marblequest. The marble-madness port was anchored on the TS client tree
(client/src/games/marble-madness) after a researcher traced registry wiring and
declared it the "last working path". The ACTUAL working implementation was the native
Rust crate rapid-game/rust/games/marble-madness (1,413 lines: world.rs, systems.rs,
physics.rs, bundles.rs — full game logic, wasm.rs only a render bridge). It was
misfiled TWICE as "physics backend for the TS client" / "dead browser-architecture
crate" — the second time DELETED on my recommendation (recoverable: git 36b199f and
the wordslide-codex checkout). Maintainer had to escalate repeatedly; five UAT
defects (ball look, HUD, terrain, portals, streaming) trace at least partly to
porting the older path.

ROOT CAUSE: theory-first classification of an artifact that was never READ. A
1,413-line crate with world/systems/bundles cannot be a "physics helper" — one
90-second read of systems.rs would have falsified the theory. The registry-wiring
evidence for the TS path was real but stale; recency of the Rust crate (it is the
teased-out, still-compiling artifact GPT-Sol was actively moving) outweighed it and
was never weighed.

Fix direction: grounding rule — before declaring any path "the live one", READ the
competing artifact's source (not its filename, not its Cargo description), and when
two implementations coexist, git-date both and explain WHY the newer one is not the
reference before proceeding. Candidate hook: none obvious; this is a briefing-rule
fix for researcher agents (add to claude-kit researcher agent prompt).
