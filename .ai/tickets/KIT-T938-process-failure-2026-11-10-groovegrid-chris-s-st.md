---
id: KIT-T938
title: Process failure 2026-11-10 (groovegrid): Chris's standing rulings from 2026-11-09 (scene metadata is stored in the scene, inert outside Song
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T16:32:18Z
updated: 2026-11-10T17:05:22Z
---

## Description
Process failure 2026-11-10 (groovegrid): Chris's standing rulings from 2026-11-09 (scene metadata is stored in the scene, inert outside Song mode, brings a scene back into Song mode; Song level holds only driving parameters; roles project level) sat as untriaged inbox notes (inbox 2136, 2139) and were never promoted to decisions. The master plan and S4 were built with Song-level curve storage and role-keyed presence, contradicting them; Chris had to repeat himself in capitals. Root cause: verbatim rulings captured to the inbox instead of t decide, no pre-design search of the inbox, orient does not replay un-triaged rulings. Prevention: a ruling captured via cap that quotes the maintainer is promoted to a decision the same turn; orient and the planner brief search the inbox for rulings before any design.

kit-bug-shape: cap:bug:process-failure-2026-11-10-groovegrid-chris-s-st
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] cap prints RULING CAPTURED with the t decide --from promotion for a note that quotes the maintainer; plain, bug-error-text and --done captures print none
- [x] Stop blocks once on a ruling captured this turn, warns on older un-promoted ones, silent after t decide --from / t triage --skip
- [x] orient lists un-promoted rulings (id, age, first line) in their own block before the generic inbox count
- [x] design/plan dispatches cite [rulings-checked: ...] while the inbox holds un-triaged notes; every block carries the BLOCK TRIAGE footer
- [x] protocol in the global contract source, cap, decide, triage, work and drain; tests with mutation evidence

## Plan
1.

## History
- [2026-11-10 16:32] (created) bug — Process failure 2026-11-10 (groovegrid): Chris's standing rulings from 2026-11-09 (scene metadata is stored in the scene, inert outside Song
- [2026-11-10 17:01] (landed) 6e78dce plugin 0.1.38: a maintainer ruling resting in the inbox is demanded, listed and cited: cap prints RULING CAPTURED, Stop
- [2026-11-10 17:04] (comment) criterion added: cap prints RULING CAPTURED with the t decide --from promotion for a note that quotes the maintainer; plain, bug-error-text and --done captures print none
- [2026-11-10 17:04] (comment) criterion added: Stop blocks once on a ruling captured this turn, warns on older un-promoted ones, silent after t decide --from / t triage --skip
- [2026-11-10 17:04] (comment) criterion added: orient lists un-promoted rulings (id, age, first line) in their own block before the generic inbox count
- [2026-11-10 17:04] (comment) criterion added: design/plan dispatches cite [rulings-checked: ...] while the inbox holds un-triaged notes; every block carries the BLOCK TRIAGE footer
- [2026-11-10 17:04] (comment) criterion added: protocol in the global contract source, cap, decide, triage, work and drain; tests with mutation evidence
- [2026-11-10 17:04] (comment) ticked: cap prints RULING CAPTURED with the t decide --from promotion for a note that quotes the maintainer; plain, bug-error-text and --done captures print none
- [2026-11-10 17:05] (comment) ticked: Stop blocks once on a ruling captured this turn, warns on older un-promoted ones, silent after t decide --from / t triage --skip
- [2026-11-10 17:05] (comment) ticked: orient lists un-promoted rulings (id, age, first line) in their own block before the generic inbox count
- [2026-11-10 17:05] (comment) ticked: design/plan dispatches cite [rulings-checked: ...] while the inbox holds un-triaged notes; every block carries the BLOCK TRIAGE footer
- [2026-11-10 17:05] (comment) ticked: protocol in the global contract source, cap, decide, triage, work and drain; tests with mutation evidence
- [2026-11-10 17:05] (comment) @kit-agent: Landed in 6e78dce: cap RULING CAPTURED receipt, Stop block-once plus stale warning, orient rulings block, rulings-checke (full comment #1 in ## Notes)
### comment #1 [2026-11-10 17:05] @kit-agent
Landed in 6e78dce: cap RULING CAPTURED receipt, Stop block-once plus stale warning, orient rulings block, rulings-checked dispatch gate, t decide --from, t triage --skip, protocol in contract/commands. Follow-up gate miss: KIT-T939. Publish sha in the hand-back.
- [2026-11-10 17:05] (status) todo → review
- [2026-11-10 17:05] (landed) 4db5a72 KIT-T938: orient lists rulings near the top, above the generic inbox count (contract and cap wording); tickets KIT-T938 
