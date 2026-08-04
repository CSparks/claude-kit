---
id: KIT-T175
title: init-project CLAUDE.md gains an agent-facing "Data repo (git)" section — junction layout, sync-data auto-commit, pathspec etiquette, push runbook
type: feature
status: todo
priority: medium
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: [KIT-T143, KIT-T160]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.069Z
updated: 2026-08-04T15:20:02.069Z
---

## Description
# The data repo's git contract is operator-facing only — sessions learn it by accident

Chris asked (2026-08-04, stiletto session): "Is Claude Kit doing a good job of outlining
how to maintain claude-kit-data from a git perspective?" Grounded answer: the mechanism
is solid, the agent-facing outline is missing.

## Evidence (lived, same session)
- The per-project CLAUDE.md that `init-project` appends describes the whole `.ai/`
  workflow but never states `.ai` is a junction into a separate repo, that `sync-data`
  auto-commits it at Stop, or any manual-commit etiquette. The session learned the
  dual-repo layout only from orient's "data repo (.ai)" line.
- Consequence: the session hand-committed the data repo (`cd .ai && git add -A`) —
  repo-wide add swept `projects/jollys-vinyl/agents.jsonl` into a stiletto-labeled
  commit ("capture: ST-T047 UAT ...", acb7547 in claude-kit-data). The Stop hook would
  have done the same add under the honest generic message; the hand commit was both
  redundant ceremony AND mislabeled cross-project churn.

## Proposed fix (small)
`init-project`'s CLAUDE.md template gains a short **"Data repo (git)"** section:
1. `.ai` resolves into `claude-kit-data` (centralized mode, KIT-D008); the project repo
   ignores it — that separation is what keeps workflow chatter out of public repos.
2. `sync-data` auto-commits + pushes it at Stop — do NOT hand-commit as ceremony.
3. If a hand commit is ever warranted, scope the pathspec to `projects/<this-project>/`
   or keep the generic `sync: workflow data` message — never a project-labeled message
   over a repo-wide `add -A`.
4. On a reported PUSH FAILED, the runbook is: `git -C <data> pull --rebase && git -C
   <data> push`, never force.
Related: KIT-T143 (split-brain reconcile, still todo) covers the de-adoption drift path;
consider an orient warning when a previously-centralized project's `.ai` stops resolving
into the data repo.

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
