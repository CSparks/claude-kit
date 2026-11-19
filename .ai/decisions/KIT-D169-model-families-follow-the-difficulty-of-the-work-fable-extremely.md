---
id: KIT-D169
title: Model families follow the difficulty of the work: Fable extremely difficult and deep, Opus very hard, Sonnet medium, Haiku automation
summary: The capability table routes by difficulty: Fable 5.2 for extremely difficult, deep problems; Opus 5.5 for very hard problems; Sonnet 5.5 for medium difficulty; Haiku for mostly automation.
date: 2026-11-18
supersedes: KIT-D042 KIT-D043
source: Chris 2026-11-18, relayed verbatim by the road-generator coordinator
implemented_by: 
no_work: no row changed family; the table header comment is still to be written (the config edit was refused by auto mode)
revised: 2026-11-19
---

**Maintainer:** "Fable 5.2 for extremely difficult, deep problems. Opus 5.5 for very hard problem. Sonnet 5.5 for medium difficulty, Haiku for mostly automation."

**Decision:** The dispatch capability table (claude-kit `.ai/config.yml` dispatch.jobs) is read as a difficulty ladder. Fable 5.2: extremely difficult, deep problems (the `deep` row, and the fallback of the hardest plans). Opus 5.5: very hard problems (design, greenfield, creative UI, asset and spatial authoring, forensic root-cause of a real defect, complicated plans). Sonnet 5.5: medium difficulty (fixes, wiring, refactors and test authoring, research, implementing an exhaustive brief, coordination). Haiku: mostly automation (chores: search, triage, mechanical edits, scripted runs). A job's row names the family for its usual difficulty; a dispatch whose problem is harder than its row escalates one rung with `[escalate: <reason>]`, as before. Every row's current family already sits on the rung the ladder gives its usual difficulty, so no row changed family on 2026-11-18; the rows whose rung the ladder does not settle are raised to the maintainer (targeted-change, build, plan, design). Writing the ladder into the table's header comment is still to do: the edit of `.ai/config.yml` was refused by the session's auto-mode check on 2026-11-18.

**Why:** stated by the maintainer as the routing rule for the four families.

**Assistant-added:** (unconfirmed) The open rows: targeted-change runs on haiku today (KIT-D088) although a targeted code change is not automation; build runs on sonnet for exhaustive briefs while the coordinator reads "multi-system builds" as very hard; plan runs on opus with a fable fallback and design on opus while the coordinator reads design and global systems as extremely difficult. RDG-D118 (road-generator, Opus floor until 03:00 2026-11-18) has lapsed and does not conflict.

[restates-ok: KIT-D035 and KIT-D061 (the firepower and version-pinned ladders, the latter replaced by the KIT-D080 table) named the same families by tier; this is the maintainer's new difficulty wording for the current table, not a repeat of them]

**Relates:** supersedes KIT-D042 (fable tops the firepower ladder) and KIT-D043 (sonnet off the coding ladder), the July ladders this one replaces; KIT-D080, KIT-D088, KIT-D098, KIT-D165 stand (the table and its job rows); RDG-D118 has lapsed.
