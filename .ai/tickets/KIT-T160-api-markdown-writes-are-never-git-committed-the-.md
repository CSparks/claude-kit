---
id: KIT-T160
title: API markdown-writes are never git-committed: the UI display_name edit (config.yml) and any UI comment/status write sit uncommitted until some session happens to commit them - machine-local until then, defeating cross-device durability (KIT-D044 markdown-truth includes git). Need an auto-commit policy for API writes on in-repo stores (immediate commit-per-write, or a debounced sweep like sync-data's Stop-hook path). Found when the maintainer asked 'committed and pushed?'
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-08-02T21:53:15.835Z
updated: 2026-08-16T01:30:58Z
---

## Description
API markdown-writes are never git-committed: the UI display_name edit (config.yml) and any UI comment/status write sit uncommitted until some session happens to commit them - machine-local until then, defeating cross-device durability (KIT-D044 markdown-truth includes git). Need an auto-commit policy for API writes on in-repo stores (immediate commit-per-write, or a debounced sweep like sync-data's Stop-hook path). Found when the maintainer asked 'committed and pushed?'

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] Every server write path (comment, criterion tick/add, ticket create, status, display_name) schedules an auto-commit of the store it wrote
- [x] The commit is pathspec-limited to that store (never `git add -A`); in the shared data repo it is limited to the single `projects/<name>` subtree
- [x] Rapid writes coalesce into ONE commit per repo (debounce window, default 4s)
- [x] A store dir outside any git repo is a no-op; `KIT_API_AUTOCOMMIT=0` disables it
- [x] A git failure warns on stderr and never fails the API response (fail-open)
- [x] Tests cover all of the above (`server/store-commit.test.mjs`, wired into `npm test`)

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. One new module `server/store-commit.mjs` — scope resolution, debounce map, fail-open commit.
2. Call it from `writes.mjs` `afterWrite` (all ticket writes) and `setProjectDisplayName`.
3. Tests over temp git repos; run the server suite + `npm test`.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

`server/store-commit.mjs` (new) queues a debounced, pathspec-limited commit after every
successful API write; `server/services/writes.mjs` calls it from `afterWrite` (comment, tick,
add-criterion, create, status) and from `setProjectDisplayName` (config.yml). Subject shape is
`ui: <verb> <id> [no-log: api write]` — a burst collapses to `ui: N api writes [no-log: api write]`.
Scope comes from `git rev-parse --show-toplevel/--show-prefix` at the store dir, so a junctioned
`.ai` resolves the way git will actually match it; in the shared data repo the pathspec is
narrowed to the single `projects/<name>` subtree (KIT-T230), never another session's subtree.

PUSH POLICY: the auto-commit does NOT push. Publishing from a web write is a policy call
(credentials, rebase-on-reject, other machines' in-flight work) — the existing `sync-data` Stop
hook remains the push path for the data repo. If a per-write push is wanted it needs its own
decision.

Switches: `KIT_API_AUTOCOMMIT=0` disables; `KIT_API_AUTOCOMMIT_DELAY_MS` overrides the 4s window.
Fail-open throughout: not-a-repo, stage failure, commit failure and a vanished repo all warn (or
silently no-op) and never surface in the API response.

Evidence: `node --test server/store-commit.test.mjs` — 5 passed (one-commit-one-path with an
out-of-pathspec negative control, burst coalescing, non-git no-op, disabled switch no-op,
no-throw on git failure); `node --test server/server.test.mjs` — 29 passed; full `npm test` green.

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-16 01:27] (status) todo → doing
- [2026-08-16 01:30] (status) doing → review
- [2026-08-16 01:30] (comment) API writes now auto-commit: new server/store-commit.mjs (debounced, pathspec-limited, no push) wired into writes.mjs; server/store-commit.test.mjs 5 passed, server.test.mjs 29 passed, npm test green
