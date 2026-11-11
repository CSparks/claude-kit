---
id: KIT-T940
title: Process failure 2026-11-10 (pixelvision): design-job dispatch (opus) blocked by dispatch-escalation (KIT-T432) because the brief lacked [esc
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:05:14Z
updated: 2026-11-10T17:05:14Z
---

## Description
Process failure 2026-11-10 (pixelvision): design-job dispatch (opus) blocked by dispatch-escalation (KIT-T432) because the brief lacked [escalate: <reason>]. Root cause: the global dispatch checklist lists job/read-only/maintainer-words/reuses tags but not [escalate:], which every design (opus) dispatch with no ticket needs. Prevention: add [escalate: <reason>] to the contract dispatch checklist line and to the design/analyst agent definitions (context-loading update, KIT-D156).

kit-bug-shape: cap:bug:process-failure-2026-11-10-pixelvision-design-jo
first seen in pixelvision. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Agent follow-through: user-config/CLAUDE.global.md checklist line now carries [escalate: <reason>] (job dearer than the ticket type default); agents/analyst.md and analyst-max.md carry a Dispatcher line naming it; scripts/contract-rules.test.mjs 17 passed (new assertions: base contract, both analyst agents; control: HEAD contract fails the regex). Composed ~/.claude/CLAUDE.md is produced by bootstrap, not by publish; not run here. Publish held (live-claims.mjs by session da28715f).

## History
- [2026-11-10 17:05] (created) bug — Process failure 2026-11-10 (pixelvision): design-job dispatch (opus) blocked by dispatch-escalation (KIT-T432) because the brief lacked [esc
- [2026-11-10 19:20] (comment) @claude: Landed in the owning commands: commands/work.md and commands/drain.md dispatch checklist now name [escalate: <reason>] f (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:20] @claude
Landed in the owning commands: commands/work.md and commands/drain.md dispatch checklist now name [escalate: <reason>] for a job dearer than the ticket type's default (design/opus with no ticket); scripts/contract-rules.test.mjs 14 passed (new assertion per command), plugin 0.1.40 so sessions load it. NOT done: the contract line in user-config/CLAUDE.global.md (my brief forbids editing CLAUDE.md-named files; a kit session or the maintainer adds the [escalate: <reason>] clause to that checklist line) and the design/analyst agent definitions. q gates agent already prints the escalate tag.
- [2026-11-10 19:21] (landed) 36022f6 Dispatch checklist in /work and /drain names [escalate: <reason>] (plugin 0.1.40); landing notes for KIT-T930, T931, T93
