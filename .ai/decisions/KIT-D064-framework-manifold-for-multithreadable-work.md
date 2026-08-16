## 2026-08-15  A framework-level manifold for multithreadable work  [KIT-D064]

Scope note: this is a **rapid-game framework** decision recorded here because the
framework has no `.ai/` store of its own (see the gap noted at the end). It moves
to the framework's store the moment one exists.

Decided: rapid-game gets ONE framework-level manifold for dispatching
CPU-heavy work off the frame thread. Every heavy workload goes through it —
named by Chris: **AI, meshing, pathfinding, entity updating**, and anything else
of that class. It is a job-execution facility, not a terrain feature.

Rejected: per-game threading, and a narrow "streamed heightfield terrain layer"
that would have solved only chunk meshing. Why: the same need recurs across
every workload and every game; a terrain-shaped fix leaves AI, pathfinding and
entity updating to be wired by hand, which is how the current bug happened.

Standing rule: a systemic capability NEVER resides in a game. Configuration may
turn it off; the mechanism lives in the framework. (Chris, 2026-08-15: "NONE OF
THESE SYSTEMIC FIXES SHOULD FUCKING RESIDE IN THE GAME. THEY SHOULD BE IN THE
FUCKING FRAMEWORK.")

### What forced this

marblequest hitched once per chunk-boundary crossing (measured: 11 chunks mount
on one tick, 2.51 ms of mesh building on the main thread, cadence exactly
`16 m / speed`). Root cause: `mesh::chunk_mesh` called from `mount_chunk` on the
main thread, violating `rg-chunk-stream`'s existing `ChunkSource` contract
(`pure/source.rs:35-43`, "Built is plain Send + Sync data") — the framework
already runs `fill` on `AsyncComputeTaskPool` (`engine/systems.rs:61-67`).

Hustle or Die hit the SAME bug independently and fixed it game-side
(`699a9c9` "triangulation moves to the worker pool"; `46b7947` "every hitch
source off the frame thread"). Two games, same bug, two separate fixes — the
definition of a missing framework capability.

### The constraint that shapes the API

Both backends must be served by one surface:
- **native** — real threads (`AsyncComputeTaskPool`, already in rg-chunk-stream).
- **browser/wasm** — a Web Worker pool (the framework already has one for the TS
  path: `ts/platform/workers/ChunkWorkerPool.ts` + `chunk.worker.ts`, unreachable
  from the Bevy/wasm path).

A Web Worker accepts DATA, never a closure. So if the worker backend is needed,
the manifold's jobs must be serializable — a job is data plus an id the worker
reconstructs its source from, returning packed arrays. A closure-shaped API works
natively and silently degrades in the browser, which is exactly the trap already
found: `multi_threaded` is enabled unconditionally
(`rg-prelude/Cargo.toml:35-37`) while nothing enables wasm atomics
(`.cargo/config.toml` sets only a getrandom backend), so the browser build reads
as threaded and is not.

### The concurrency model: snapshot in, proposals out

No locks and no races, because nothing shared is mutable. (Chris, 2026-08-15:
"I guess it doesn't [create race conditions] if they're all looking off a last
good state snapshot that doesn't change.")

- Workers are PURE FUNCTIONS of a frozen last-good snapshot. A worker never
  touches the live world.
- Results are PROPOSALS. The main thread validates and applies them at a
  barrier, single-threaded and ordered.
- Stale proposals are DROPPED, not applied. A result derived from snapshot N may
  land at frame N+k after the world moved on.

rg-chunk-stream already implements all three and is the reference shape:
`fill` off-thread → `settle` applies inside the frame gate under
`apply_budget_ms` (`engine/systems.rs:101-116`) → `pure/liveness.rs` `Token`
plus `collect()` (`systems.rs:72-87`) drop replies for chunks evicted or
re-requested while in flight.

Caveat — three of the four named workloads are pure derivations (meshing,
pathfinding, AI: snapshot → result). **Entity updating is write-back, not
derivation.** It fits only if workers emit intents/deltas the main thread
applies; conflicting writes to one entity from two workers need an explicit
resolution rule. That rule is a design decision inside the manifold — the
snapshot model does not supply it for free.

### Open at time of writing

Whether Bevy 0.19 supports real multithreading on threaded wasm (task pools AND
renderer). If it does, one backend may serve both and the serializable-job
constraint relaxes; if not, the worker bridge is required. Under verification.
Cross-origin isolation (COOP/COEP) is NOT a blocker — Chris confirmed the game
will never be iframed by him and CORS requirements can be met.

### Gap this exposed

rapid-game (the framework) has no `.ai/` plan-of-record. Framework-level
decisions currently have nowhere to live and land in the kit store by default.
Worth fixing — a framework consumed by many games needs its own decision store.
