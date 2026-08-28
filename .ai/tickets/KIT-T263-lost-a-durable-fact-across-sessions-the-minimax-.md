---
id: KIT-T263
title: Lost a durable fact across sessions: the MiniMax H3 Volta fp16 workaround (Amduraznak/minimax-h3-fp16-fix + --fp16-unet) was found and…
summary:               # OPTIONAL one-line gist — what a trail/brief shows instead of a clipped title
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
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-28T22:01:35.484Z
updated: 2026-08-28T22:01:35.484Z
---

## Description
Lost a durable fact across sessions: the MiniMax H3 Volta fp16 workaround (Amduraznak/minimax-h3-fp16-fix + --fp16-unet) was found and endorsed 2026-08-22 but never persisted to memory or a plan-of-record; the 2026-08-24 session re-derived H3 (bf16 emulation, 3x slower) until the maintainer recalled it. Root cause: no capture step for 'recipe found, not yet applied' facts in non-.ai sessions (home dir); memory writes only happen on completion. Fix: PreCompact/Stop flush prompts to persist endorsed-but-unapplied recipes/URLs to memory.

**Correction (Chris, 2026-08-25):** both the original discussion (2026-08-22) and the
re-derivation (2026-08-24) happened in `~` — NOT a kit-initiated repo. The kit's PreCompact/
Stop flush no-ops without `.ai/`, so a flush-side fix would never fire here. Real gap:
non-`.ai/` sessions have auto-memory as their only durable record, and nothing prompts a
memory write for "found/endorsed, not yet applied" facts (recipes, URLs, decisions) — only
completed work gets remembered. Fix must live in the memory discipline that runs everywhere
(CLAUDE.md rule + a hook that is NOT gated on `.ai/`), not in the `.ai/` flush.

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
