# bug: proposed a per-game fix for a concern the framework already governs

Type: process failure (bug)
Raised: 2026-08-15
Project: marblequest (rapid-game framework)

## What happened

While diagnosing a ~1 s jitter in marblequest, I measured the cause correctly (a
chunk-boundary crossing mounts a whole 11-chunk ring column on one tick, 2.51 ms
of mesh building on the main thread) and then proposed the fix **inside the
game**: move `mesh::chunk_mesh` into marblequest's `OverworldSource::fill`.

Chris rejected the framing: "Something like this should NEVER be per-game because
it's useful everywhere and there can be configuration to turn it off if need be."

## Root cause

I did not ground in the framework contract that already governs this before
proposing.

`rg-chunk-stream`'s `ChunkSource` (`pure/source.rs:35-43`) already requires
`Built: Send + Sync`, documented as "plain Send + Sync data — never engine
handles". `engine/systems.rs:61-67` already spawns every `fill` on
`AsyncComputeTaskPool`. The framework already says mesh DATA is produced
off-thread in `fill`, with only the asset handle made at mount.

marblequest violates that contract at `world/stream/mount.rs:41`, calling
`mesh::chunk_mesh` on the main thread inside `mount_chunk`.

So this was never a missing capability — it was a game breaking a rule the
framework had already written down. Proposing a game-local fix would have
entrenched the violation and left every other streaming game free to repeat it.
Hustle or Die hit the identical bug independently (`terrainStreaming.ts:118-119`,
"FULL triangulation off-thread (R076 — the steering gate caught the on-thread
clip)") and fixed it game-side too — twice now, the same bug, in two games.

## The standing lesson

Before proposing ANY fix in a game that sits on rapid-game: read the framework
contract for that concern first (the trait docs, the plugin's scheduling, the
settings defaults). If the framework already governs it, the fix is either
"make the game obey" or "fill the framework gap" — never a game-local
workaround.

## The real framework gap

Threading is at the right layer already (`rg-chunk-stream` owns the pool; leaf
builders in `rapid-game-compute`/`rg-meshkit` stay pure sync so they compose
inside it). What is missing is a reusable **streamed heightfield terrain layer**
whose `fill` returns finished mesh data — so a game cannot wire meshing onto the
wrong side of the thread boundary by accident. Two games have now had to wire it
by hand and one got it wrong.

Related: `StreamSettings::apply_budget_ms` defaults to 3.0 ms
(`pure/driver.rs:38`) and exists precisely to catch a mount spike. marblequest's
column costs 2.51 ms and slips under it by a quarter of a millisecond — and the
budget only counts CPU in `settle`, not the GPU uploads it queues. Worth
revisiting as part of the same work.
