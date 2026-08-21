---
id: KIT-T255
title: q verbs default to ALL scopes — every query context must default to the cwd project (all/explicit scope to widen)
type: bug
status: review
priority: high
milestone:
labels: []
links: [KIT-T174]
files: [scripts/q-model.mjs, scripts/q.mjs, scripts/q-fallback.mjs, scripts/q-recent.mjs, scripts/q-inbox.mjs, hooks/orient.mjs]
supersedes:
superseded_by:
created: 2026-08-21T02:58:02Z
updated: 2026-08-21T04:40:00Z
---

## Description
Every `q` verb answered CROSS-SCOPE by default, so a query run inside one repo came back
full of other projects' rows. KIT-T174 had already fixed this for `fts` alone; this
generalizes that fix into one helper — `resolveScope(scopeTok, root)` in q-model — that
every scoped verb resolves through, on both the cache and the markdown-scan path.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Every scoped q verb (open, inbox, confirmations, orphans, rundown, recent, regressions, supersedes, verify, drift...) defaults to the cwd project's scope inside an adopted repo; DB and fallback paths agree
- [x] 'all' (case-insensitive, positional or --scope) widens to every project; an explicit scope key queries that project — same vocabulary on every verb
- [x] Cross-project consumers (orient, prime/standup, index-tickets, hooks) updated to pass 'all' or an explicit scope where cross-project is the point — briefings keep their cross-project view
- [x] Outside an adopted repo the default stays every-scope (no key to default to)
- [x] Tests cover the default, 'all', explicit scope, and outside-repo fallback; q --help documents the default

## Plan
1. One helper in q-model (`resolveScope`) — the single scope vocabulary.
2. Wire every scoped verb through it in q.mjs AND q-fallback.mjs.
3. Make the cross-project consumers explicit (`all`) or per-project (an explicit key).
4. Tests + `q --help`.

## Notes

**2026-08-21 — landed.** `resolveScope(scopeTok, root)` (scripts/q-model.mjs) is the one
scope vocabulary: absent → the cwd project's key, `all`/`ALL` → '' (every project), a key →
that key upper-cased; outside an adopted repo there is no key, so the default stays
every-scope. `parseFts` (KIT-T174) and `parseInboxArgs` (KIT-T238) now delegate to it
instead of each carrying its own copy.

Verbs now cwd-defaulted on BOTH paths (q.mjs cannedQueries + q-fallback.mjs): open, inbox,
confirmations, orphans, rundown, recent, regressions, supersedes, verify, fts. `rundown`
gained a `[scope]` argument it never had — bare `rundown` is this project, `rundown all` is
the cross-project board.

Deliberately left cross-scope: `integrity` (a whole-cache consistency audit — gaps and id
collisions are only meaningful across the cache), `similar` (dedup is cross-store AND
cross-scope by design, KIT-T025), `drift`/`governing`/`mentions` (scan-only over one root,
so already cwd-confined), `next-id` (requires an explicit scope, KIT-T109), and `sessions`
(transcripts, its own `--project` filter).

Consumers made explicit: hooks/orient.mjs now passes `open ['all']` — its "by scope" line IS
the cross-project view, so it must not inherit the new default (the in-flight lines still
re-filter to the cwd key). scripts/index-tickets.mjs already passed its project's `scopeKey`
per KIT-T125, so it needed no change. scripts/survey.mjs (the /prime and /standup briefing)
never touches q — it scans the registry directly, so the cross-project briefing is unaffected.
commands/drain.md updated to name the default and `all`.

Tests: scripts/q.test.mjs 89 passed (resolveScope default/`all`/explicit/outside-repo, plus
per-verb default→`all`→key coverage for open/orphans/regressions/supersedes/rundown/recent,
scan-path parity, and a CLI check that another project never leaks into a bare `rundown`);
scripts/q-recent.test.mjs rewritten for the root-taking signatures with an adopted fixture and
a non-adopted tmp root — ok. Full suite: 60/62 test commands green. Three pre-existing
failures unrelated to this change and reproduced on unmodified main: scripts/agent-pins.test.mjs
(agents/rg-ui-engineer.md has no `effort:` pin), hooks/big-ask-nudge.test.mjs and
server/server.test.mjs (both environmental — the harness's `new URL(...).pathname` keeps `%20`
for the space in the worktree path, and node_modules is empty so `express` is unresolvable).
Adjacent suites re-run green: db-parity 21, db-cache 66, orient 24, index-tickets 34,
cli-help 18, query-gate all pass.

## History
- [2026-08-21 02:58] (created) bug — q verbs default to ALL scopes — every query context must default to the cwd project (all/explicit scope to widen)
- [2026-08-21 02:58] (comment) criterion added: Every scoped q verb (open, inbox, confirmations, orphans, rundown, recent, regressions, supersedes, verify, drift...) defaults to the cwd project's scope inside an adopted repo; DB and fallback paths agree
- [2026-08-21 02:58] (comment) criterion added: 'all' (case-insensitive, positional or --scope) widens to every project; an explicit scope key queries that project — same vocabulary on every verb
- [2026-08-21 02:58] (comment) criterion added: Cross-project consumers (orient, prime/standup, index-tickets, hooks) updated to pass 'all' or an explicit scope where cross-project is the point — briefings keep their cross-project view
- [2026-08-21 02:58] (comment) criterion added: Outside an adopted repo the default stays every-scope (no key to default to)
- [2026-08-21 02:58] (comment) criterion added: Tests cover the default, 'all', explicit scope, and outside-repo fallback; q --help documents the default
- [2026-08-21 02:58] (comment) @claude: Directive (Chris, 2026-08-20): 'The context pretty much needs to be set by default to the current repo in every query co (full comment #1 in ## Notes)
### comment #1 [2026-08-21 02:58] @claude
Directive (Chris, 2026-08-20): 'The context pretty much needs to be set by default to the current repo in every query context. You should have to either reference all projects or a specific project, if querying outside of the current repo.' Precedent: KIT-T174 did exactly this for fts (defaultScope in q-model.mjs). Repro: q recent from stiletto listed MAR/GB decisions and created(274) cross-project.
- [2026-08-21 02:59] (status) todo → doing
- [2026-08-21 04:40] (comment) resolveScope in q-model is the one scope vocabulary; open/inbox/confirmations/orphans/rundown/recent/regressions/supersedes/verify/fts default to the cwd project on the cache AND scan paths; orient passes `all` to keep its cross-project banner
- [2026-08-21 04:40] (comment) tests: q.test.mjs 89 passed, q-recent.test.mjs ok, db-parity 21, db-cache 66, orient 24, index-tickets 34, cli-help 18; full suite 60/62 commands green (agent-pins / big-ask-nudge / server pre-existing, reproduced on unmodified main)
- [2026-08-21 04:40] (status) doing → review
