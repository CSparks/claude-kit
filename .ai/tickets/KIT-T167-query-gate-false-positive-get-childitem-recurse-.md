---
id: KIT-T167
title: query-gate false positive: `Get-ChildItem -Recurse D:\dev\claude-kit-data\projects\gridiron-blitz` (listing a project's .ai workflow DATA dir to inventory tickets) was BLOCKED as "grepping the source tree to discover code" (check-id: source-discovery, 2026-08-02). Workflow-data inventory is exactly what the .ai contract asks for at session start and code-graph cannot answer it. The gate should exempt .ai/ paths, the claude-kit-data store, and other non-source data directories from source-discovery.
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
links: [KIT-T114]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-04T15:20:02.015Z
updated: 2026-08-16T00:26:04Z
---

## Description
query-gate false positive: `Get-ChildItem -Recurse D:\dev\claude-kit-data\projects\gridiron-blitz` (listing a project's .ai workflow DATA dir to inventory tickets) was BLOCKED as "grepping the source tree to discover code" (check-id: source-discovery, 2026-08-02). Workflow-data inventory is exactly what the .ai contract asks for at session start and code-graph cannot answer it. The gate should exempt .ai/ paths, the claude-kit-data store, and other non-source data directories from source-discovery.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] `source-discovery` no longer claims paths carrying a `.ai` or `claude-kit-data` segment.
- [x] The repro `Get-ChildItem -Recurse D:\dev\claude-kit-data\projects\gridiron-blitz` exits 0.
- [x] A `.ai/` listing still blocks — under `store-grep`, which routes to `q`.
- [x] Negative controls hold: `rg foo src/` and `find src -name "*.ts"` still block.
- [x] Tests: hooks/query-gate.test.mjs — all pass.

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Add a `targetsWorkflowData()` predicate to hooks/query-gate.mjs and exempt both
   discovery rules (recursive search + find/gci) from it.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
The exemption is scoped to the source-discovery rule only, and is principled rather than a
loosening: code-graph indexes no workflow data, so redirecting a `.ai`/claude-kit-data listing
at it was a dead end. RULE 1 (store-grep) still fires first for `.ai` paths, so the store keeps
its `q`-only route; the central data root, which matches no store pattern, is simply allowed.
Test evidence: hooks/query-gate.test.mjs all pass (new cases cover the repro, the store-grep
arbiter, and two negative controls); `npm test` clean.

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
- [2026-08-16 00:12] (status) todo → doing
- [2026-08-16 00:26] (status) doing → review
- [2026-08-16 00:26] (comment) source-discovery exempts .ai / claude-kit-data paths; store-grep stays the arbiter. query-gate.test.mjs all pass
