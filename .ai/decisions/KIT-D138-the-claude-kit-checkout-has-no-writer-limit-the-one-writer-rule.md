---
id: KIT-D138
title: The claude-kit checkout has no writer limit; the one-writer rule is for compiled build trees only
summary: Parallel writers are allowed in the claude-kit checkout; the checkout-holder and foreign-edits dispatch gates must not block them
date: 2026-11-07
supersedes: 
source: conversation 2026-11-07 (Chris)
---


**Maintainer:** "They are two writers writing changes to KIT and KIT is not a fucking compiled language project, so there should not BE a fuckign writer limit on KIT. This is failure all the fuck over."

**Decision:** The claude-kit checkout (scripts, hooks, tickets: interpreted code, no build tree) takes any number of parallel writers. The dispatch-guard checks `checkout-holder` (KIT-T811, KIT-D123) and `foreign-tree-edits` (KIT-T407) do not block a writer dispatched into claude-kit. The one-writer-per-checkout rule (KIT-D077) stays for compiled game and framework trees, where concurrent writers race a build.

**Why:** In claude-kit nothing compiles, so two writers contend only for the git index and HEAD, which each writer handles by committing only its own files (the KIT-T874 agent did). The block stopped the KIT-T860 and KIT-D137 fix for an hour while the dirt-empire bail landing sat red. Rejected: keeping the writer limit on claude-kit.

**Assistant-added:** Commit discipline for parallel kit writers (stage only your own files by path, never `git add -A`) is the replacement safeguard.

## Notes
Maintainer 2026-11-07, same exchange: "The ONLY writer limit on Claude Kit should be that two writers on one file is forbidden." Refines the decision: the claude-kit dispatch gate is per FILE, not per checkout. A dispatch is refused only when its brief names a file another live writer is editing; any number of writers on disjoint files run in parallel.
