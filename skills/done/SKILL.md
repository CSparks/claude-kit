---
name: done
description: Close a reviewed claude-kit ticket with explicit human acceptance. Use only when the user asks to mark a ticket done, accepts UAT, or approves closure of a review-stage item.
---

# Close a reviewed ticket

Read `../../commands/done.md` completely and follow it. Treat the user's request text as
`$ARGUMENTS`. The user's explicit invocation supplies the human acceptance required by this
workflow. Invoke related workflows as `$skill-name` rather than `/command`, and resolve `<kit>`
from this skill's plugin root.
