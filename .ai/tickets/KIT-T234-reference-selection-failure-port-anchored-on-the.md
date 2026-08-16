---
id: KIT-T234
title: Reference-selection failure: port anchored on the superseded TS path, native Rust crate dismissed unread
type: bug
status: todo
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
created: 2026-08-16T00:06:36.486Z
updated: 2026-08-16T00:06:36.486Z
---

## Description
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
