---
id: KIT-T975
title: q code: more than one --path value silently returns no results although a symbol exists in the first path (q code daemonStateLine --path scr
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T19:10:46Z
updated: 2026-11-10T19:18:06Z
---

## Description
q code: more than one --path value silently returns no results although a symbol exists in the first path (q code daemonStateLine --path scripts hooks returns none; --path scripts alone finds 12 hits); should accept several paths or refuse with a message

kit-bug-shape: cap:bug:q-code-more-than-one-path-value-silently-returns
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 19:10] (created) bug — q code: more than one --path value silently returns no results although a symbol exists in the first path (q code daemonStateLine --path scr
- [2026-11-10 19:15] (landed) ab32079 q code: q-code-paths module for several --path values, imported (implements KIT-T975)
- [2026-11-10 19:16] (landed) d278a3e q code: --path records every value through addPath (implements KIT-T975)
- [2026-11-10 19:16] (landed) 16f7589 q code: several --path values keep only files under any of them (implements KIT-T975)
- [2026-11-10 19:16] (landed) b72568e q code: the empty-filter message names every --path (implements KIT-T975)
- [2026-11-10 19:18] (comment) @claude: Cause: parseCodeArgs took one --path value; 'q code X --path scripts hooks' made 'hooks' part of the search text ('X hoo (full comment #1 in ## Notes)
### comment #1 [2026-11-10 19:18] @claude
Cause: parseCodeArgs took one --path value; 'q code X --path scripts hooks' made 'hooks' part of the search text ('X hooks' found nothing). Fix: scripts/q-code-paths.mjs; repeated --path keeps only files under any named path (q code, sym, file); a bare word after --path that names a path and an empty result now says 'repeat the flag: --path a --path b'. Evidence: scripts/q-code-paths.test.mjs 6 passed (repeat, single-path control, sym/file, stray-word hint, no-hint controls, parse), code-index.test.mjs 30 passed, q.test/q-path-outside/q-server/q-code-target pass. Commits ab32079 d278a3e 16f7589 b72568e + final. The holder gate let one Edit through per commit on code-index-query.mjs (stale da28715f ledger, KIT-T944 residual), so the change landed as five small commits.
- [2026-11-10 19:18] (status) todo → review
