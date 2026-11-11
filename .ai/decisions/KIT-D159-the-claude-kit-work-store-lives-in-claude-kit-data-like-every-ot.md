---
id: KIT-D159
title: The claude-kit work store lives in claude-kit-data like every other project, and no store falls behind on commits or pushes
summary: Kit's own .ai moves to claude-kit-data; every store write is committed and pushed promptly
date: 2026-11-11
supersedes: 
source: conversation 2026-11-11
---


**Decision:** The claude-kit repo's own `.ai/` store moves to `claude-kit-data/projects/claude-kit/`
and is linked the same way every adopting project is (KIT-D016). No work store, in claude-kit-data
or anywhere else, is allowed to sit uncommitted or unpushed: every store write is committed and
pushed promptly, whichever session or project wrote it.

Maintainer, 2026-11-11, on seeing 428 uncommitted files in the claude-kit checkout (396 tickets,
17 decisions): "That should all be living in claude-kit-data and it should NOT be falling behind
on commits/pushes."

**Why:** On 2026-11-11 the kit checkout held 428 uncommitted files, 413 of them store files, with
decisions KIT-D131 to KIT-D157 (17 files) and about 100 tickets on one disk only. The same day
claude-kit-data held 240 uncommitted files across 15 dormant project subtrees (KIT-T892). The kit
store is the one store every session writes to, and it is the only one still inside a code repo,
so store writes from other sessions never pass a commit path. Rejected: leaving the kit store
in-repo with a sweep, since KIT-D016 already makes claude-kit-data the single home for `.ai/`.
