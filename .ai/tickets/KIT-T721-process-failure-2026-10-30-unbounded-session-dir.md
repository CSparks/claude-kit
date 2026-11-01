---
id: KIT-T721
title: PROCESS FAILURE 2026-10-30 (unbounded session, dirt-empire gears): told the maintainer 'you decided no sim gears' from a q fts snippet ('kee
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T04:16:17Z
updated: 2026-10-31T00:46:09Z
---

## Description
PROCESS FAILURE 2026-10-30 (unbounded session, dirt-empire gears): told the maintainer 'you decided no sim gears' from a q fts snippet ('keep no [gears]') that was the REJECTED option in DE-D018; the decision actually chose virtual gears and the audio-only scope was the question author's framing, not a maintainer choice. Root cause: asserting a decision's content from a search-hit excerpt without q show. Guard wanted: q fts hits on decisions show the Decision line, not a context window; and/or a rule that attributing a decision to the maintainer requires q show of the item.

kit-bug-shape: cap:bug:process-failure-2026-10-30-unbounded-session-dir
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fix 299e015: q fts prints a decision's **Decision:** paragraph (scripts/q-decision-hit.mjs, clipped to 240 chars) instead of the match window, so a hit inside the Rejected line can no longer read as the decision (DE-D018 case). Evidence: scripts/q-fts.test.mjs 8 passed (decision hit, ticket hit unchanged), q 112, db-parity 21, q-server 8. Not built: a rule that attributing a decision to the maintainer requires q show; that is CLAUDE.md contract text and needs the maintainer's approval.
Rule added to the global CLAUDE.md base source (user-config/CLAUDE.global.md) next to the state-claim receipt rule: read the decision with q show <id> before attributing it to the maintainer, else 'not checked' (KIT-D122; coordination-model, runtime-wiring, search-adoption passed; commit 47e3dcc). q-side fix: 299e015.
### Handoff adbb68fdaa83e0807
- Jobs: none running; dirt-empire j-mvvhdz77-09ippr, j-mvvg3ebj-ejwjfa, j-mvvj5a05-ty89pj read for evidence
- State: in review; KIT-D122 rule added to user-config/CLAUDE.global.md in 47e3dcc. Runtime publish b0xe0qt6d FAILED (git commit exit 3221225794 = 0xC0000142 in D:\dev\.kit-verify-b83d356-30400); not yet published, current is 773fb4a, stale publish.lock (pid 24508) may remain.
- Next: run bootstrap so the composed ~/.claude/CLAUDE.md carries it (the composed file is not edited by hand).
- Files: user-config/CLAUDE.global.md

## History
- [2026-10-30 04:16] (created) bug — PROCESS FAILURE 2026-10-30 (unbounded session, dirt-empire gears): told the maintainer 'you decided no sim gears' from a q fts snippet ('kee
- [2026-10-30 23:25] (comment) @kit-agent: claimed by the standing kit agent (this session), after T718
- [2026-10-30 23:32] (landed) 299e015 q fts: a decision hit shows its Decision paragraph, not a match window that can sit in the Rejected line (q-fts 8, q 112
- [2026-10-30 23:36] (status) todo → review
- [2026-10-31 00:39] (landed) 47e3dcc global CLAUDE.md: attributing a decision to the maintainer requires reading it with q show, else 'not checked' (KIT-D122
- [2026-10-31 00:46] (status) review → review
