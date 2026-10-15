---
id: KIT-T509
title: Every .ai item type is written through a kit command, never a hand Write: inventory each store write (tickets, inbox, questions, decisions, notes, epics, requests, ticket Notes, SESSION.md, resolved, agents/dispatch logs) with its command or gap; add the missing verbs to t (or one centralized tracking command); a pre-write hook refuses a hand Write/Edit into a typed store folder and names the command; document the convention
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T15:07:53Z
updated: 2026-10-15T15:41:02Z
fixed_commit: f70e9b2
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T481, KIT-T508, KIT-T507
### comment #1 [2026-10-15 15:08] @claude
Chris 2026-10-15 verbatim: 'I think any "type" should either get it's own command or the type should be part of a centralized tracking command.' / 'So if there are any other potential write issues that will run afoul of KIT interactions, we should wrap them now.' / 'We probably should anyway to create/maintain a convention.' Context: auto mode's classifier skipped hand Writes to .ai/decisions and refused a SESSION.md line as instruction poisoning (2026-10-14/15); t decide (KIT-T481) already wraps decisions.
### comment #2 [2026-10-15 15:11] @claude
INVENTORY (2026-10-15, before any change). Store write -> command today, or GAP.

- ticket new: `t new <type> "<title>"` OK. Description at creation: GAP (scaffoldNew takes opts.description but the CLI never passes it; the body is a placeholder filled by hand Edit).
- ticket status: `t status` OK. criteria: `t tick|untick|criterion` OK. links: `t link` OK. comment: `t comment` OK (History line; spills to Notes only when multi-line).
- ticket `## Notes` prose: GAP (direct Edit by KIT-D037 convention; no verb).
- epics/requests lifecycle (status, tick, link, comment): GAP. findTicket only searches tickets/ + archive, so `t status KEY-E001` throws "unknown id".
- inbox capture: `cap` OK (+ `cap topic`). Triage promotion: `triage.mjs --plan/--apply` OK (moves caps to inbox/triaged/).
- questions: create via `cap question` then triage (two steps, no direct verb): GAP for direct create; `t ask`, `t resolve` OK.
- decisions: `t decide --file` OK (KIT-T481).
- notes (KEY-N###): GAP direct (only cap observation + triage).
- epics (KEY-E###) / requests (KEY-R###) create: GAP direct (only cap epic|request + triage; `t new epic` refuses and points at cap).
- reminders: `rem add|done|snooze|disable|enable` OK.
- `.ai/resolved/`: `cap --done` OK.
- SESSION.md: GAP (hand Edit/Write only; flush hook nags but no writer).
- agents.jsonl / agents-progress.jsonl: written by hooks (agent-roster recordAgent/updateAgent, progress); no human verb needed. dispatch-outcomes.mjs is read-only. model-lineup.json: model-refresh.mjs. read-receipts.json: `t ack`.
- generated views INDEX.md / REGRESSIONS.md / SUPERSEDED.md / ROADMAP.md (generated mode): `index-tickets.mjs`, also run by every `t` mutation. A hand edit is the failure.
- config.yml: configuration, not an item; hand edit stays.

Plan: fill the GAPs in `t` (t-notes, t-session, t-create modules wired through t-verbs.mjs; findTicket widened to epics/requests); pre-write check-id `store-write` refuses hand creation of typed-store files, hand writes to SESSION.md and generated views and hook-owned logs, naming the command.
Landed f70e9b2 (verbs + store-write check) and da2050c (convention docs, CLAUDE.md + project-template/CLAUDE.snippet.md). Tests: scripts/t-verbs.test.mjs 7 passed, hooks/store-write-gate.test.mjs 21 passed, plus t 109, t-decide 4, pre-write 36, flush 18, cap 41, rem 36, triage and 30 other chain suites green; npm test chain stops nowhere in my files. Chose: hook allows hand Edit of an existing item's prose (Description/Notes/Plan, KIT-D037) and refuses creation + SESSION.md + generated views + hook-owned logs. Not wrapped: triage ROUTE_STORE maps no requests/epics route (cap request lands in tickets/) - direct t request/t epic bypass it; runtime publish deferred behind the other kit writer's publish.

## History
- [2026-10-15 15:07] (created) feature — Every .ai item type is written through a kit command, never a hand Write: inventory each store write (tickets, inbox, questions, decisions, notes, epics, requests, ticket Notes, SESSION.md, resolved, agents/dispatch logs) with its command or gap; add the missing verbs to t (or one centralized tracking command); a pre-write hook refuses a hand Write/Edit into a typed store folder and names the command; document the convention
- [2026-10-15 15:08] (comment) @claude: Chris 2026-10-15 verbatim: 'I think any "type" should either get it's own command or the type should be part of a centra (full comment #1 in ## Notes)
- [2026-10-15 15:11] (comment) @claude: INVENTORY (2026-10-15, before any change). Store write -> command today, or GAP. (full comment #2 in ## Notes)
- [2026-10-15 15:41] (status) todo → review
- [2026-10-15 15:41] (comment) t-verbs.test.mjs 7 passed, store-write-gate.test.mjs 21 passed, f70e9b2 da2050c
