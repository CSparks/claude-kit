---
id: KIT-D056
title: KB home — two trees per KIT-D004, both FTS-indexed
date: 2026-08-05
supersedes:
source: conversation 2026-08-05 (questionnaire: "Two trees with database index.")
---

**Decision:** Reaffirms KIT-D004 — top-level `research/` IS the cross-project
knowledgebase; library docs and context7 distillations (KIT-D055) land there under
its README's rules. `docs/research/` stays the kit's OWN design docs (KIT-T-id
flavored) and is not the KB. Both trees join the FTS doc index — `research/` is
added to KIT-T101's docs-in-FTS list (docs/research, docs/design, docs/strategy)
so `q fts` covers KB + design docs uniformly.

**Why:** Zero file moves; honors the settled D004 split (generic cross-project
findings vs project-flavored design docs); the skill doc had silently drifted to
naming `docs/research/` the KB and this session propagated that drift into the
KIT-D055 contract rule before catching it (process-failure capture: inbox
2026-08-05-1907). Rejected: single-tree merges in either direction — one mixes kit
design docs into the generic index, the other moves ticket-flavored docs into the
KB that D004 explicitly kept out.
