---
id: KIT-D139
title: The only writer limit, in every project, is that two writers on one file is forbidden
summary: Parallel writers are allowed in any checkout of any project; dispatch is refused only when two writers would edit the same file
date: 2026-11-07
supersedes: KIT-D077
source: conversation 2026-11-07 (Chris)
---


**Maintainer:** "The ONLY writer limit on Claude Kit should be that two writers on one file is forbidden." "And that IS univeral for all projects."

**Decision:** In every project, any number of writers may work in one checkout in parallel. The only limit is per file: a dispatch is refused when two writers would edit the same file (a file another live writer holds uncommitted, or that the brief names for two writers). The one-writer-per-checkout rule (KIT-D077) and the checkout-holder and foreign-tree-edits gates are replaced by a file-overlap gate. This extends KIT-D138 (claude-kit) to all projects.

**Why:** A checkout-wide limit idled work behind a lock on files nobody else was touching; the real hazard is two writers on one file. Rejected: keeping a per-checkout limit for compiled trees.

**Assistant-added:** Where a broker daemon owns a compiled tree, writers still submit patches and the daemon applies them serially (broker-owned-tree), so file-overlap is checked at patch submission; each writer stages only its own files by path.
