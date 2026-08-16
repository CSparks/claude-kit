---
id: KIT-T228
title: agents.jsonl roster ordering: PostToolUse(Task) writes the in-flight row AFTER SubagentStop's done row for synchronous agents, so the…
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
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-16T00:06:34.571Z
updated: 2026-08-16T00:22:28Z
---

## Description
agents.jsonl roster ordering: PostToolUse(Task) writes the in-flight row AFTER SubagentStop's done row for synchronous agents, so the last-row-wins roster shows them permanently UNCOLLECTED — orient flagged 13 long-done agents on 2026-08-07 resume. Root cause: hook event order for foreground Task calls; reconcile-on-read or ts-compare needed, not manual reconcile rows.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] readAgents collapses with a TERMINAL RATCHET: a later `in-flight` row never overrides an earlier `done`/`error`/`collected`/`merged` row for the same id (later rows still enrich the other fields).
- [x] An out-of-order pair already ON DISK (pre-fix rows) reconciles on read — no manual reconcile rows, no orient UNCOLLECTED flag.
- [x] An in-order `in-flight` → `done` completion still collapses forward (the ratchet doesn't freeze live agents).
- [x] The write-side workaround in agent-roster.mjs (`dispatchStatus`) is removed — one reconcile point, not two.
- [x] hooks/agent-roster.test.mjs reproduces the out-of-order write and fails without the fix (mutation-checked: 5 assertions flip to FAIL).

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Move AGENT_TERMINAL above readAgents in hooks/lib.mjs; apply the ratchet in the collapse loop.
2. Drop dispatchStatus from hooks/agent-roster.mjs (read-side reconcile subsumes it).
3. Add reconcile tests to hooks/agent-roster.test.mjs; mutation-check; run npm test.

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
- [2026-08-16 00:10] (status) todo → doing
- [2026-08-16 00:22] (status) doing → review
- [2026-08-16 00:22] (comment) Fixed at the read side: hooks/lib.mjs readAgents now ratchets on terminal status — a later in-flight row can never override an earlier done/error/collected/merged row for the same id, so a synchronous agent's out-of-order PostToolUse row no longer resurrects it as permanently UNCOLLECTED. Reconciles rows already on disk (the 2 resurrected ids in .ai/agents.jsonl), not just new ones. Removed the write-side workaround dispatchStatus() from hooks/agent-roster.mjs — one reconcile point. Tests: hooks/agent-roster.test.mjs +5 reconcile assertions, 46 passed 0 failed; mutation check (disable the ratchet) flips 5 assertions to FAIL. Full npm test: 33 suites, 345 passed, 0 failed (+14 node:test pass); server/server.test.mjs fails only because this worktree has no node_modules (express) — pre-existing, unrelated.
