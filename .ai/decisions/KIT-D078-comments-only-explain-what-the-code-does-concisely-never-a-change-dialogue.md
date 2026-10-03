---
id: KIT-D078
title: Comments only explain what a block of code does, concisely, never as a dialogue about changes
summary: A comment exists to tell a reader what a block does; concise; no was/now/used-to, quotes, dates or history; a comment that does not explain the code is cut.
date: 2026-10-03
supersedes:
source: conversation 2026-10-03 (Chris)
---

**Decision:**
1. A comment exists only to tell a reader what a block of code does.
2. Comments are concise. A comment that does not explain the code is cut, not reworded.
3. A comment is never a running dialogue about changes: no history, no "was / now / used to / no longer", no quotes of who asked, no dated stamps. A bare ticket or decision id is the ceiling.
4. The doc-comment and rare-inline guidance of KIT-D059 stands where it does not contradict 1-3.
5. Landed in the base contract (`user-config/CLAUDE.global.md` § SELF-COMMENTING CODE); the comment-length and comment-narration gates cite the rule in their messages.

**Why:** Chris, 2026-10-03: "The only purpose comments serve is to explain to someone who is reading the code what is happening in a block of code." and "Comments should be concise. They should not be a running dialogue about changes." Extends KIT-D059, which banned backstory but left room for rationale prose.
