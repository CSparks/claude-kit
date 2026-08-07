---
id: KIT-D063
title: A model version named in a request is BINDING — dispatch lands on exactly that id or stops and says why it can't
date: 2026-08-07
supersedes: (amends KIT-D061 — adds the request-level override rule)
source: AskUserQuestion 2026-08-07 (Chris, verbatim): "It should always name versions specifically and if I call out a version in the request, that's what it should use."
---

**Decision:** When Chris names a model version in a request ("fix it with an Opus 4.8"),
that version is a hard constraint on the dispatch, overriding tier defaults. The
orchestrator lands the delegation on exactly that full id — via an agent whose
frontmatter pins it (KIT-D061 rule 3) — or, if no pinned lane exists yet, STOPS and
surfaces that before dispatching on anything else. Silently substituting the alias
resolution (what happened 2026-08-07: "Opus 4.8" dispatched as `opus` → Opus 5) is a
dispatch bug.

Riders:
1. **Receipts name the resolved full id, never the alias** — "dispatched to opus" hides
   exactly the drift this rule exists to catch; Chris caught the 2026-08-07 miss from the
   agent UI, not the receipt.
2. KIT-T209 (scaffold the 4.8-pinned scoped/ui agents) is the missing enforcement lane —
   until it lands, every 4.8 request forces the stop-and-surface path.

**Why:** KIT-D061 already made tiers full-id pins because aliases drift. The same logic
applies one level up: a version Chris says out loud is a pin, not a preference. He
authored the version-tiered ladder the day before the miss; "Opus 4.8" in a request is
him naming a lane deliberately.
