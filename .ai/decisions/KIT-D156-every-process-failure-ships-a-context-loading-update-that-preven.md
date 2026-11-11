---
id: KIT-D156
title: Every process failure ships a context-loading update that prevents its recurrence
summary: A process failure is closed by a change to what the model loads (CLAUDE.md contract, orient, agent definition, skill or gate message), not only by a ticket or a promise to be careful.
date: 2026-11-09
supersedes: 
source: conversation 2026-11-09 (Chris, pixelvision session)
---


**Maintainer:** "Process failures need have context loading updates to prevent them in the future."

**Decision:** When a process failure is triaged (KIT-D154), its prevention is a concrete edit to loaded context: the global contract (CLAUDE.md base), the SessionStart orient text, the agent or skill definition, or the gate's own block message, so the rule is in front of the model before it can repeat the mistake. A ticket that only names the failure does not close it. The kit agent lands the edit at the source and relays the runtime sha.

**Why:** Tickets and in-session resolutions do not reach later sessions; the 2026-11-09 pixelvision session repeated the same class of slips (committing or recording a decision without flushing SESSION.md, dispatching without job/tree/maintainer-words tags, reading a store with sed instead of q show) because nothing in loaded context warned against them.

**Assistant-added:** Instances from this session to fix first: (1) flush SESSION.md at every commit, landing receipt and decision (contract + orient); (2) every dispatch carries [job: id], the '[Model x.y] label', [tree:] for non-repo writers, and for feature briefs [maintainer-words:] and [reuses:] (contract dispatch section + agent definitions); (3) store items are read with q show or Read, never sed/cat (contract); (4) an Artifact publish from the scratchpad uses the long path, not the 8.3 short form (contract overlay).

## Notes
Needs a signed bill for the kit agent (KIT-D132); raised to the maintainer.
