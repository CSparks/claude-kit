---
id: KIT-D155
title: Other sessions in the kit checkout raise no flag unless two sessions write the same files
summary: in the claude-kit checkout, a second live session is normal; the holder guard and any session-overlap notice fire only when two sessions edit the same file
date: 2026-11-09
supersedes: 
source: conversation 2026-11-09 (Chris, stiletto-2349)
---


**Maintainer:** "There will be other sessions on KIT, that shouldn't be raising flags unless the two are writing to the same files."

**Decision:** In the claude-kit checkout, several live sessions at once is normal. No block, warning or hand-back notice fires because another session is live or has recently written there. A flag fires only when two sessions write the same file: the second writer's edit or commit touching a path the other live session has changed and not yet committed. The checkout-holder guard (KIT-T811, KIT-D123) and the commit-foreign gate are narrowed to that per-file test for the kit checkout. A holder's last-write time and a dirty tree alone are never a flag. Amends KIT-D144 for the kit checkout only: the one-writer limit there becomes a one-writer-per-file limit. Other repos keep KIT-D144 as it stands until the maintainer says otherwise.

**Why:** 2026-11-09 stiletto-2349 spent turns waiting on the claude-kit-db hold and on a "foreign edits" reading while the two sessions touched different files; claude-kit-db and the kit writer shared the checkout without conflict once the files were distinct.

**Rejected:** removing the guard entirely (two sessions on one file lose work); keeping the whole-checkout hold (it blocks sessions that touch different files).

**Assistant-added:** Related KIT-D144, KIT-D148, KIT-T811, KIT-D123, KIT-T894.
