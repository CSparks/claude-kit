---
id: KIT-D068
title: an unbounded catch-all store is the default destination for a session with no repo cwd
summary: no .ai above the cwd resolves to ONE configured catch-all store; identity is per item (topic + session), never per store, and never inferred
date: 2026-08-25
supersedes:
source: conversation 2026-08-25; inbox 2026-08-25-0319; bug 2026-08-25-0307
---

**Decision:** A session with no `.ai/` above its cwd resolves to ONE unbounded catch-all
store — a standard `.ai/` layout at `<dataRoot>/unbounded/.ai`, overridable with
`CLAUDE_KIT_UNBOUNDED_AI` and pinned per machine in the project registry. `cap`, `t`, `q`
and the orientation + flush hooks all resolve through one function
(`hooks/lib/unbounded.mjs` → `resolveStoreRoot`); the commit gate stays repo-scoped.
Identity is carried **per item**, not per store: every capture is stamped with the harness
`session` id (persisted to `<store>/.ai/.session` by SessionStart, since the CLIs get no hook
payload) and with a `topic` slug set EXPLICITLY by `cap topic <slug>`. Retrieval is a
generated view — `q topics`, `q --topic <slug>` — and promotion into a project is
`t move <id> <repo-path>`.

**Why:** KIT-T189 listed three candidate destinations: refuse with the project list, a
kit-level tray, or infer the project from the session transcript. Refusing is what was
already happening in practice and is how the H3 Volta recipe was lost (bug
2026-08-25-0307) — a capture deferred is a capture lost. Inference was rejected outright:
picking the wrong project is the exact failure KIT-T186/KIT-T067 exist to prevent, and a
silently-inferred label is worse than no label. The tray wins, with two conditions that
answer T189's remaining objections: it must be a REAL store (the standard layout, so triage,
`q` and the id machinery work there unchanged — nothing rots in a dead drop), and its items
must be self-labelling, because one catch-all holds many unrelated threads. Hence `topic`,
set by hand and never derived from a prompt: at most, SessionStart REMINDS that none is set.
`t move` is what keeps the tray from becoming a graveyard — the item goes to its project the
moment one is identified, re-keyed to that project's id scheme with the old id kept as `aka:`
and a pointer left behind.
