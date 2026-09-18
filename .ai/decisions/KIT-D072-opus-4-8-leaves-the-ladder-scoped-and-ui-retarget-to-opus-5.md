---
id: KIT-D072
title: Opus 4.8 leaves the dispatch ladder — scoped and ui retarget to Opus 5
summary: No kit agent or tier uses claude-opus-4-8; scoped -> claude-opus-5/medium, ui -> claude-opus-5/high, implementer -> claude-opus-5/low.
date: 2026-09-18
supersedes: KIT-D061 (the scoped + ui rows only; every other row and rules 1-4 stand)
source: conversation 2026-09-18 (Chris directive + AskUserQuestion, 2 answers); research/effort-cost-index-2026-09.md
---

**Decision:** Kit agents and dispatch tiers stop using `claude-opus-4-8`; Opus 5 takes its lanes.

| tier | was | now |
|---|---|---|
| scoped | claude-opus-4-8 / high | claude-opus-5 / medium |
| ui | claude-opus-4-8 / high | claude-opus-5 / high |

- `agents/implementer.md` repins `claude-opus-4-6`/medium -> `claude-opus-5`/low (the `standard`
  tier it serves). Opus 4.6 stays tierless (KIT-D061 rule 4).
- KIT-T209 (scaffold 4.8-pinned agents for scoped/ui) is moot — no versioned lane remains to
  scaffold.
- KIT-D063 stands: a version NAMED in a request is still binding. With no 4.8-pinned agent, a
  4.8 request is a stop-and-surface.
- Adopted repos carrying the D061 ladder (`inv4d3rs`, `stiletto-2349`) take the same two-row edit.

**Why:** Chris, 2026-09-18: "All Claude-Kit agents should avoid using Opus 4.8 and use Opus 5
going forward." Effort is re-derived, not carried (KIT-D061 rule 2): `scoped` exists to stop
over-scoping, and the KB records Opus 5 scope creep rising with effort, so it lands at medium —
0.76 of high's cost on Anthropic's effort cost index. `ui` takes high, the creative fallback Chris
already named in KIT-D061 ("falling back to opus 5 high").

Rejected: both tiers at opus-5/high (high is where Opus 5 over-scopes — the failure `scoped`
guards); deleting `scoped` as a duplicate of `careful` (breaks tickets carrying `tier: scoped`;
the name still records intent).
