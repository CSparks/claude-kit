---
id: KIT-D157
title: A session-start framework pin is a rule, not a ticket; a breaking change becomes top-priority local tickets
summary: Pulling and pinning the framework at session start cites no ticket; a breaking change found while pinning becomes priority one, fixed through local tickets in that codebase.
date: 2026-11-11
supersedes: 
source: conversation 2026-11-10 (Chris, stiletto-2349 session, KIT-T891 questionnaire)
---


**Maintainer:** "This is a fucking rule. A project uses RG, a session starts, it fucking pulls an dpins. Thi sisn't a ticket. A ticket is a one time thing." and "If in the ceremony of pulling and pinning there is a breaking change in that codebase, it becaoms priority number one with local tickets for that codebase to fix the breaking change."

**Decision:**
1. The session-start pull and pin of the framework (KIT-D141) is a standing rule. It cites no ticket and creates none: no "framework pin sync" ticket, no ticket per pin. The land and commit paths that demand a ticket id exempt a rule-driven pin.
2. A breaking change found while pulling and pinning becomes priority number one in that project. It is fixed through local tickets in that codebase. It is not a question put to the maintainer, not a capture left in an inbox, and not a ticket in the kit store.
3. KIT-T891 builds slice 1 (report-only fetch, delta, may-break crates, conflict forecast) and slice 2 (the stale re-pin line in frameworks/rapid-game.md) now. In unbrokered trees the hook advances a clean submodule checkout to origin/main and the session commits the pin after a scoped build.

**Why:** a ticket is one-time work; the pin is a recurring ceremony. A breaking change is real work in the consuming game, so it belongs in that game's own queue at top priority.

**Rejected:** a standing pin-sync ticket per project; a new ticket per pin; raising a break to the maintainer by a marker line plus inbox capture; a questionnaire before resolving a conflict.
