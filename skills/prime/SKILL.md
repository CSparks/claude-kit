---
name: prime
description: Reconstruct a human-readable briefing from durable claude-kit state across one or more projects. Use when starting or resuming work, catching up after a gap, or asking what currently needs attention.
---

# Prime from durable state

Read `../../commands/prime.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Ignore Claude-specific model hints in that file. Invoke related workflows as
`$skill-name` rather than `/command`, and resolve `<kit>` from this skill's plugin root.
