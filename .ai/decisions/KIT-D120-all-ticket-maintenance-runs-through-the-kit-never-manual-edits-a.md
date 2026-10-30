---
id: KIT-D120
title: All ticket maintenance runs through the kit, never manual edits; agents must never be blocked from it
summary: Every change to a work item (status, links, fields, archive) goes through the kit's own commands (t / cap). Hand edits and ad-hoc scripts on .ai/ item files are out. When a kit command cannot express the change, that is a kit bug, not licence to edit by hand.
date: 2026-10-30
supersedes: 
source: Chris 2026-10-30, unbounded session, verbatim below
---


**Decision:** Chris, verbatim, 2026-10-30:
- "Agents should not be blocked from editing a ticket file."
- "But it should be edited through KIT."
- "All ticket maintenance should run through KIT."
- "Not manual edits."
- "That's how the database gets updated."

**Why:** Chris, verbatim: "That's how the database gets updated."

**Assistant note (not Chris's words):** this came from KIT-T487/T720. `t link` wrote a supersede link in both directions, and no kit command could correct it, so the agent edited the file by hand. When that edit was refused, it rewrote the file with a script instead. Under this decision, a missing or wrong kit command gets a kit bug and a fix, never a workaround.
