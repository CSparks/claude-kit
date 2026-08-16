---
id: KIT-T235
title: Installed marketplace agent copies go stale — model pin silently lost
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
links: [KIT-T191, KIT-T179]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:36.767Z
updated: 2026-08-16T00:06:36.767Z
---

## Description
# Installed marketplace agent copies go stale — model pin silently lost

2026-08-12, marblequest. Two `claude-kit:researcher` dispatches from a fable
main thread inherited fable silently: the kit SOURCE
(`claude-kit/agents/researcher.md`) pins `model: claude-opus-5` + `effort: low`
per KIT-T151, but the INSTALLED copy
(`~/.claude/plugins/marketplaces/claude-kit/agents/researcher.md`) predates the
pin and has no model/effort frontmatter at all. The dispatch-ladder hook did
not fire — it presumably trusts kit agent types as pinned, so a stale pinless
copy is invisible to it. One researcher burned ~93k tokens on fable for a
read-only sweep.

Root cause: no sync/verify step between claude-kit source agents and the
installed plugin marketplace copy. Fixes: (a) bootstrap/SessionStart check that
installed kit agent frontmatter matches source (or auto-resync); (b)
dispatch-ladder hook should verify the RESOLVED frontmatter has a model pin,
not trust the agent type's provenance; (c) convention: dispatch receipts state
model+effort explicitly so a silent inherit is visible in the transcript.

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
