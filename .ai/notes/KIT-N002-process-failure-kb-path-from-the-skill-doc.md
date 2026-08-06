---
id: KIT-N002
title: Process failure — the KB path was grounded on a skill doc instead of the decisions store
created: 2026-08-06
links: [KIT-D004, KIT-D055, KIT-D056]
---

2026-08-05 (context7 / KB work): asserted `docs/research/` as the canonical knowledgebase — in a
capture and in the KIT-D055 contract rule landed in `user-config/CLAUDE.global.md` — citing the
claude-kit SKILL doc ("docs/research/ → the cross-project knowledgebase"). The decisions store said
otherwise: **KIT-D004** (2026-06-02) designated top-level `research/` as the KB, and its README +
empty index were sitting there. The four docs under `docs/research/` are kit DESIGN docs, not KB
entries.

Root cause: grounded on a derived doc (a skill's prose) rather than the decision of record. The
antidote is already in the contract ("never assert decisions from memory — read the record"); this
is an instance of not doing it, and the record of the instance is the value here.

Already settled: **KIT-D056** reconciled the drift (two trees, both FTS-indexed), so no work item
remains. Kept as a note so the next KB question starts from the decision, not the skill doc.

Provenance: `.ai/inbox/triaged/2026-08-05-1907-process-failure-kb-path-grounded-on-skill-doc-not.md`.
