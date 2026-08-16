---
id: KIT-T237
title: bug: proposed a per-game fix for a concern the framework already governs
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T105]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:37.656Z
updated: 2026-08-16T00:35:36Z
---

## Description
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

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

Codified at user-config/CLAUDE.global.md, 'Process failure' antidote: grounding now explicitly includes the framework/base-layer contract that already governs the concern, so a per-game fix for a framework-governed concern is caught before it is proposed. Governing decision: KIT-D064.

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-16 00:32] (status) todo → doing
- [2026-08-16 00:35] (status) doing → review
- [2026-08-16 00:35] (comment) codified as framework-contract grounding in CLAUDE.global.md (KIT-D064) [no-test: doctrine]
