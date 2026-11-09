---
id: KIT-D144
title: A writer is a live session or agent, never an uncommitted file
summary: dispatch-guard and checkout-holder identify writers from the holder registry only; modified or untracked files never count as a writer and never block a dispatch
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris, stiletto-2349)
---


**Maintainer:** "UNCOMMITTED FUCKING FILES IS NOT THE DEFINITION OF A WRITER." and "IT SHOULD HAVE A LIMIT, BUT THERE AREN'T CURRENTLY ANY FUCKING WRITERS."

**Decision:** foreign-tree-edits (KIT-T407) and checkout-holder (KIT-T811/D123) find a writer in the holder registry only: a session or agent with a recent write in that checkout. Dirty tracked or untracked files never count as a writer and never block a dispatch. The one-writer limit itself stays.

**Why:** 2026-11-08 in stiletto-2349 the guard blocked a writer dispatch because 13 of Chris's own hand-edited files looked like a second writer, with no session or agent running and Chris the only user.

**Rejected:** treating dirty files as a writer signal with an override token (the maintainer's own edits are not a writer); dropping the limit (two live writers in one checkout is still the failure it prevents).

**Assistant-added:** Related KIT-T885, KIT-T886, KIT-T882.
