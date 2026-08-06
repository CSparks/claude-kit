---
id: KIT-N003
title: Process failure — a plan-doc layout decision contradicted the live checkout's own git history
created: 2026-08-06
links: [KIT-T187, KIT-T188]
---

2026-08-05: declared the live rapid-game `rust/` workspace "dormant 2025-era" and split new crates
into a fresh `framework/` workspace. The finding actually came from the STALE
`D:\dev\rapid\rapid-game` checkout (last commit 2025-11) and was applied to the LIVE submodule (HEAD
2026-07-17, 37 members, HOD actively builds `rg_render_wasm`). Caught by the maintainer, not
self-caught.

Root cause: a layout decision recorded without grounding it in the TARGET checkout's own history —
two copies of a repo on one machine, and the survey read the wrong one. Antidote: for any layout or
"is this alive?" judgement, read that checkout's `git log` and its live manifest first (the same
provenance-first rule KIT-T079 applies to module identity).

No work item: the decision was corrected in place at the time. Kept as a note because the failure
shape — a stale sibling checkout standing in for the live one — will recur, and because it is part
of why plan-of-record retrieval got tickets (KIT-T187 / KIT-T188).

Provenance: `.ai/inbox/triaged/2026-08-05-1712-plan-doc-layout-decision-contradicted-the-on-dis.md`.
