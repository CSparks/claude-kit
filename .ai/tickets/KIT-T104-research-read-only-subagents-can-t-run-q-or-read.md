---
id: KIT-T104
title: RESEARCH/READ-ONLY SUBAGENTS CAN'T RUN `q` OR READ `.ai/` — so a subagent told to "ground via q and the inbox" silently degrades to working around it. Hit 2026-06-06: a researcher subagent (tools: WebSearch/WebFetch/Read/Grep/Glob/Write — no Bash) could not invoke `node scripts/q.mjs`, AND `.ai/` (inbox, lineage.yml, tickets) was invisible to its Glob/Read (dotfile exclusion / gitignore). It grounded from docs/research/ + live source + the directive text in the prompt instead — work landed, but it could NOT verify the governing inbox decisions or the work-graph trail. FIX options: (a) enable a `q`-only Bash/tool path in agent contexts; (b) parent passes the relevant `q trail`/inbox/lineage content INTO the subagent prompt; (c) make `.ai/` readable by agent file tools. The failure mode to design OUT: a subagent silently substituting "I'll work around it" for the prescribed grounding — it should surface/block, not degrade quietly. Relates to KIT-T050 (retrieval gate) + the cap routing bug (1813).
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
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.661Z
updated: 2026-08-16T00:35:44Z
---

## Description
RESEARCH/READ-ONLY SUBAGENTS CAN'T RUN `q` OR READ `.ai/` — so a subagent told to "ground via q and the inbox" silently degrades to working around it. Hit 2026-06-06: a researcher subagent (tools: WebSearch/WebFetch/Read/Grep/Glob/Write — no Bash) could not invoke `node scripts/q.mjs`, AND `.ai/` (inbox, lineage.yml, tickets) was invisible to its Glob/Read (dotfile exclusion / gitignore). It grounded from docs/research/ + live source + the directive text in the prompt instead — work landed, but it could NOT verify the governing inbox decisions or the work-graph trail. FIX options: (a) enable a `q`-only Bash/tool path in agent contexts; (b) parent passes the relevant `q trail`/inbox/lineage content INTO the subagent prompt; (c) make `.ai/` readable by agent file tools. The failure mode to design OUT: a subagent silently substituting "I'll work around it" for the prescribed grounding — it should surface/block, not degrade quietly. Relates to KIT-T050 (retrieval gate) + the cap routing bug (1813).

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

Fixed at the agent definition: agents/researcher.md already grants Bash (tools: Read, Grep, Glob, Bash, WebSearch, WebFetch), so scripts/q.mjs is reachable; its Operating context now directs grounding through q (not file tools over the .ai store) and forbids silently substituting a workaround - surface the gap instead. agents/README.md carries the general rule: an agent told to ground gets Bash, and its body says to surface rather than degrade.

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
- [2026-08-16 00:35] (comment) researcher.md has Bash; grounding + no-silent-degrade lines added to agent + agents/README [no-test: doctrine]
