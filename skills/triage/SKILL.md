---
name: triage
description: Drain claude-kit inbox captures into tickets, questions, decisions, and notes, then report the prioritized worklist. Use when the user asks to triage captures, process the inbox, or organize incoming work.
---

# Triage captures

Read `../../commands/triage.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Ignore Claude-specific model hints in that file. Invoke related workflows as
`$skill-name` rather than `/command`, and resolve `<kit>` from this skill's plugin root.
