---
name: standup
description: Show a read-only cross-project claude-kit status briefing without resuming or mutating work. Use when the user asks for a standup, status glance, current queue summary, or what needs their attention.
---

# Show a read-only standup

Read `../../commands/standup.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Ignore Claude-specific model hints in that file. Invoke related workflows as
`$skill-name` rather than `/command`, and resolve `<kit>` from this skill's plugin root.
