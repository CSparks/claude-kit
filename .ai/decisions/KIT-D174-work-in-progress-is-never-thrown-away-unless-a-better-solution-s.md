---
id: KIT-D174
title: Work in progress is never thrown away unless a better solution supersedes it; nothing broken ships
summary: Never discard a paused draft, unmerged feature or parked patch unless something better supersedes it; keep it, flag it off, or finish it; anything with hope of use stays in version history; nothing broken is committed to the shipped path.
date: 2026-11-21
supersedes: 
source: Chris 2026-11-20, road-generator session; promoted to every project 2026-11-21
implemented_by: KIT-T1463
no_work: 
---


**Decision:** Work in progress (a paused draft, an unmerged feature, a parked patch) is never deleted or dropped because it regressed a number or is inconvenient. It is kept, flagged off, or finished. Anything with hope of use stays reachable in version history (a commit, a kept patch file, a named ref) and the ticket notes say where. Removal from the tree is allowed only when the work stays in history and the replacement is named. This is no licence for breaking changes with no good reason or for committing code that does not work: the shipped path stays working, and unfinished work goes behind a flag or into history.

**Maintainer:** "I want to make sure we're pushing changes and NOT losing effort." And: "If there is work in progress, DO NOT _EVER_ fucking throw it away unless it's been superceded by a better solution." And: "That is not to say we ever want to create breaking changes for no good reason or commit shit code that doesn't work, but if there's still hope to get something useful out of it, it needs to be in the git history somewhere."

**Why:** stated by the maintainer in the road-generator session, where a paused draft was about to be reverted before a push. His priority is that pushes carry the effort forward and nothing with a chance of use is lost, without shipping broken code.

**Assistant-added:** (unconfirmed) a questionnaire for a push never offers deleting unsuperseded work; a revert is acceptable only when the work stays in history and the notes name where. Origin: road-generator decision RDG-D142, promoted to every project by his approval of a questionnaire on 2026-11-21.
