---
id: KIT-T161
title: # cap bug: milestone with subjective-value output drained end-to-end with zero human-UAT gates

Lived failure (groovegrid video-pipeline, 2026-07-23/24): five tickets (GG-T113..T116,
T137) were drained and landed on green suites and mechanical receipts (determinism,
sample-alignment, quantization law) before the maintainer watched ONE second of
output. First human viewing produced the verdict "ill-conceived bunch of bullshit" —
the entire milestone's value criterion (is the video watchable?) was subjective and
NO ticket carried a human-only acceptance criterion. Watchable output existed at
T113 stage 2; the drain blew past it because nothing structural said stop.

ROOT CAUSE: acceptance criteria were all machine-checkable, so the drain's
auto-execute logic saw only green. The base contract even warns "only the maintainer
judges visuals" — but nothing enforces a human gate when a milestone's value IS the
visual/subjective output.

WANT: structural, not memory-dependent —
- ticket/milestone frontmatter flag (e.g. `uat_gate: human`) that the drain treats
  like statuses.human_only: after the FIRST ticket producing user-facing output
  lands, the drain HALTS the milestone until the maintainer records a UAT verdict;
- triage/init nudge: when capturing a milestone whose deliverable is
  visual/audio/content, require at least one human-only acceptance criterion per
  ticket.
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
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-02T21:53:15.841Z
updated: 2026-08-02T21:53:15.841Z
---

## Description
# cap bug: milestone with subjective-value output drained end-to-end with zero human-UAT gates

Lived failure (groovegrid video-pipeline, 2026-07-23/24): five tickets (GG-T113..T116,
T137) were drained and landed on green suites and mechanical receipts (determinism,
sample-alignment, quantization law) before the maintainer watched ONE second of
output. First human viewing produced the verdict "ill-conceived bunch of bullshit" —
the entire milestone's value criterion (is the video watchable?) was subjective and
NO ticket carried a human-only acceptance criterion. Watchable output existed at
T113 stage 2; the drain blew past it because nothing structural said stop.

ROOT CAUSE: acceptance criteria were all machine-checkable, so the drain's
auto-execute logic saw only green. The base contract even warns "only the maintainer
judges visuals" — but nothing enforces a human gate when a milestone's value IS the
visual/subjective output.

WANT: structural, not memory-dependent —
- ticket/milestone frontmatter flag (e.g. `uat_gate: human`) that the drain treats
  like statuses.human_only: after the FIRST ticket producing user-facing output
  lands, the drain HALTS the milestone until the maintainer records a UAT verdict;
- triage/init nudge: when capturing a milestone whose deliverable is
  visual/audio/content, require at least one human-only acceptance criterion per
  ticket.

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
