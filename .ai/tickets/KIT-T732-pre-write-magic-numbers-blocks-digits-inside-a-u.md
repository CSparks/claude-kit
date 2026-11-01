---
id: KIT-T732
title: pre-write magic-numbers blocks digits inside a URL path: edge/sites/daemonelectricity.caddy line 'redir /2018/02/26/thing-hasnt-taken-russia
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T21:44:46Z
updated: 2026-10-30T21:46:27Z
---

## Description
pre-write magic-numbers blocks digits inside a URL path: edge/sites/daemonelectricity.caddy line 'redir /2018/02/26/thing-hasnt-taken-russian-hackers-yet-ok-lets-update/ /posts/ permanent' (max-age=31536000 in the same file passed). Digits that are part of a URL/path token (preceded by /) are not magic numbers; .caddy is also a config/infra file the gate should skip.

kit-bug-shape: cap:bug:pre-write-magic-numbers-blocks-digits-inside-a-u
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed: .caddy/Caddyfile join the config class; digits in a URL path token (slash after no operand) are ignored in code. Evidence: hooks/pre-write.test.mjs 39 passed incl. division x/60 still blocks; hooks/exclusions.test.mjs all pass.

## History
- [2026-10-30 21:44] (created) bug — pre-write magic-numbers blocks digits inside a URL path: edge/sites/daemonelectricity.caddy line 'redir /2018/02/26/thing-hasnt-taken-russia
- [2026-10-30 21:46] (status) todo → review
- [2026-10-30 21:46] (landed) 144a41d Magic-numbers ignores digits in a URL path token and skips .caddy/Caddyfile; implements KIT-T732
