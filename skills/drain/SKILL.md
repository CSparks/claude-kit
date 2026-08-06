---
name: drain
description: Select and execute the next ready claude-kit backlog item according to .ai/config.yml. Use when the user asks to drain the queue, keep going, pull the next task, or work the backlog without naming a ticket.
---

# Drain the work queue

Read `../../commands/drain.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. Invoke related workflows as `$skill-name` rather than `/command`. Resolve `<kit>`
from this skill's plugin root; `PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` both identify that root
inside plugin hooks.
