---
id: KIT-D052
title: global contract compacted — same rules, fewer lines
date: 2026-08-05
supersedes:
source: conversation 2026-08-05 ("Go ahead and compact that config then. It's pretty heavy.")
---

**Decision:** `user-config/CLAUDE.global.md` is compacted ~374 → ~250 lines with zero
rule loss. Every hard-rule phrasing, dated Chris quote, and KIT-D/T citation survives;
what went was narration — war stories compressed to rule + quote, the modular section's
triple restatement, the hook exclusion syntax table (each gate's footer already prints
its check-id and both surfaces at the moment a block fires).

**Why:** 397 composed lines load every session; rules compete for attention, so a
shorter contract makes each surviving rule weigh more. Rejected: cutting the dated
quotes (they are the behavioral anchors — compress the what, never the why).
