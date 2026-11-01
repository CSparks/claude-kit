---
id: KIT-D125
title: The maintainer's word that a fix works closes the ticket; Claude runs the close, never hands back /done
summary: When the maintainer reports a fix works ("it's fixed"), Claude closes the ticket at once with t status <id> done --human and links fixed_commit. No kit text, hook or receipt asks the maintainer to run /done.
date: 2026-11-01
supersedes: 
source: Chris 2026-11-01, marblequest session; recorded there as MAR-D010
---



**Decision:** When the maintainer reports a fix works after UAT ("it's fixed"), Claude closes the ticket at once: `t status <id> done --human`, with `fixed_commit` linked. Claude never hands back `/done <id>` for the maintainer to run. The rule replaces "Chris sets `status: done` ... never set it myself" in the base CLAUDE.md and the project CLAUDE.md template. `human_only` still stops Claude closing on its own judgment; the maintainer's words of acceptance are the authority.

**Maintainer:** Chris, 2026-11-01 (MAR-D010): "If I fucking tell you something is fixed, YOU FUCKING CLOSE IT YOUR FUCKING SELF AND THAT SHOULD BE THE FUCKING PROCESS."

**Why:** Promoted from MAR-D010. Asking the maintainer to run the close command after he has already said it works is process added for him.

**Rejected:** keeping `/done` as the maintainer's command. It makes him repeat an acceptance he already gave.
