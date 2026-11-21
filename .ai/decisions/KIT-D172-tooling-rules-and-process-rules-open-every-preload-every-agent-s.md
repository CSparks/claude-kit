---
id: KIT-D172
title: Tooling rules and process rules open every preload, every agent start and every agent definition
summary: A short fixed block of every tooling and process rule the maintainer has stated, one line each, comes first in the session start text, is restated after each compaction and clear, is handed to every agent at start and sits first in every agent definition.
date: 2026-11-21
supersedes: 
source: Chris 2026-11-21, road-generator session
implemented_by: KIT-T1463
no_work: 
---


**Decision:** The context a session or agent starts from opens with one short, fixed block of the tooling rules and the process rules, every rule the maintainer states as a rule, with no size filter, one line each, ahead of the long state, ticket and decision listings. The block is the first text of the session start output, is restated after every compaction and clear, is handed to every subagent at its start, and is the first body section of every agent definition. When listings must shrink to stay inside the size limit, the listings shrink and the rules never do. A tooling or process rule he states is added to the block the same turn it is recorded. A check fails when the block is missing from the start output, the agent start text or any agent definition.

**Maintainer:** "That should've already been recorded so this is a process failure. This and the grep shit, I think there is something wrong in the context preload that is not either raising those things prominently enough or it's just not mentioned at all. Tooling in big process rules should always get prominent placement there." And, correcting the first wording: "Tooling AND process rules".

**Why:** stated by the maintainer. The same rules were broken again and again (shell greps of named files by agents, ids in replies, unrecorded directives), which shows the preload did not carry them prominently, or at all.

**Assistant-added:** built as one list in the kit (hooks/lib/rule-block.mjs) read by the session start hook, the agent start hook and the compaction restatement, with a test holding every agent definition to the same text.
