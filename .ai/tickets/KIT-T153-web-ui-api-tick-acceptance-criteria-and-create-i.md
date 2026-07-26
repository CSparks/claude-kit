---
id: KIT-T153
title: "Web UI/API: tick criteria + create items from the browser"
type: feature
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: [web-ui, api, store-writes]
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: [scripts/t.mjs, server/services/writes.mjs, server/routes/projects.mjs, ui/src/components/ticket/AcceptanceList.tsx]
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-25T23:53:04.853Z
updated: 2026-07-26T00:14:58Z
---

## Description
The maintainer cannot maintain the board from the board. Ticking a criterion and
creating an item are CLI-only, so a plain bookkeeping act (GG-T089: EIN obtained,
bank account opened) has to wait for an agent session. The write layer already
proves the pattern: `server/services/writes.mjs` routes comment + status through
the same `t.mjs` functions the CLI calls, so the guards, History stamping, view
regen and cache re-hydrate all stay in one owner.

This extends that surface to criteria and creation. `t.mjs` already exports
`tick()` and `scaffoldNew()`; missing are an **untick** and an **add-criterion**
function, the four endpoints, and the UI controls (`AcceptanceList.tsx` renders
deliberately disabled checkboxes today).

KIT-D032 is NOT being reversed: structured mutations still go through the `t`
code paths with their invariants — the browser becomes a second client of them,
exactly as comment/status already are. What D032's "hand-editing" prohibition
was written against was N unguarded editors, not a second guarded caller.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] `t.mjs` exports `untick()` — unchecks a criterion and stamps a
      `(comment) unticked: <text>` History line; refuses an already-open selector
      as loudly as `tick()` refuses an already-checked one
- [x] `t.mjs` exports `addCriterion()` — appends a `- [ ]` line under
      `## Acceptance Criteria` and stamps a `(comment) criterion added: <text>` line
- [x] Both reachable from the CLI (`t untick <id> <sel>`, `t criterion <id> "<text>"`)
      with the usage string updated; covered in `scripts/t.test.mjs`
- [x] Criteria selectors are stable for a UI client: the API addresses a criterion
      by its index among ALL criteria (what the detail payload exposes), not by
      `tick()`'s ordinal-among-open — the translation lives in the write layer
- [x] `POST /api/projects/:key/tickets/:id/criteria` (add) and
      `POST /api/projects/:key/tickets/:id/criteria/:index/{tick,untick}` land through
      `t.mjs` + `afterWrite()`, with the existing typed 4xx mapping (404/403/422/400)
- [x] `POST /api/projects/:key/tickets` creates a ticket via `scaffoldNew()` —
      type/title required, unknown type or empty title → 400, response carries the
      allocated id; a store with no local repo still returns 409 `not_writable`
- [x] `server/server.test.mjs` covers every new endpoint incl. the refusal paths
- [x] UI: acceptance checkboxes are live (click toggles, failure surfaces and reverts)
      and the ticket detail has an add-criterion input
- [x] UI: a New-ticket action creates in the current project and lands on the new
      ticket's detail page
- [x] Full suite green — `npm test` at the kit root, with the count cited in History

## Plan
1. `scripts/t.mjs`: factor the criterion-line scan out of `tick()`, add `untick()`
   and `addCriterion()` on top of it; wire the two CLI verbs + usage.
2. `scripts/t.test.mjs`: cover tick/untick round-trip, add, and each refusal.
3. `server/services/writes.mjs`: `setCriterion({index, checked})` +
   `addTicketCriterion()` + `createTicket()`; index→selector translation against
   the same parse `services/ticket-parse.mjs` uses, so the UI's index and the
   markdown line can never drift apart.
4. `server/routes/projects.mjs`: mount the four routes, thin handlers only.
5. `server/server.test.mjs`: endpoint + refusal coverage.
6. `ui/`: live `AcceptanceList` (toggle → API → refetch, revert on error), an
   add-criterion input, and a New-ticket form; `services/api.ts` methods.
7. Run the whole suite; cite the count.

## Notes
Decisions from the 2026-07-25 questionnaire (Chris): add BOTH new criteria and new
tickets (inbox-capture-from-UI deliberately NOT in scope); un-ticking IS allowed and
audited; build now rather than queue.

Related, deliberately out of scope: API markdown writes are never git-committed
(`inbox/2026-07-23-2043-api-markdown-writes-are-never-git-committed-the-.md`, still
untriaged). Until that lands, a criterion Chris ticks in the browser is durable in
markdown + cache locally but sits uncommitted until a session commits it — the more
the browser can write, the more that gap bites, so it should be triaged next.
### comment #1 [2026-07-26 00:14] @claude
Landed. Evidence: npm test green at the kit root - 739 assertions across 25 suites + 39 node:test cases, exit 0 (scripts/t.test.mjs 72 passed incl. untick/setCriterion/addCriterion/section-scoping; server/server.test.mjs 29 passed incl. every new endpoint and its 409/400/404 refusals). tsc -b + vite build clean. New modules: scripts/md-body.mjs (stamp/appendUnderSection/sectionRange) + scripts/criteria.mjs (the criteria concern, pure body transforms) - extracted rather than grown into t.mjs, which sat at 559 of the 600-line block. server/services/ticket-parse.mjs parseAcceptance now DELEGATES to criteria.listCriteria, so the index a client renders is the index its write addresses by construction. Latent bug fixed on the way: the old tick() scanned the WHOLE body, so a - [ ] under Plan or Notes was tickable; criteria are now section-scoped.

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
- [2026-07-25 23:53] (created) feature — triaged from Chris's 2026-07-25 interjection ("I should be able to change the status of these items and add new ones via the UI/API") after ticking GG-T089's EIN + bank-account criteria for him
- [2026-07-25 23:55] (decision) scope from questionnaire: criteria + tickets both creatable; untick allowed with a History line; build now. Inbox-capture-from-UI out of scope.
- [2026-07-25 23:54] (status) todo → doing
- [2026-07-26 00:14] (comment) ticked: `t.mjs` exports `untick()` — unchecks a criterion and stamps a
- [2026-07-26 00:14] (comment) ticked: `t.mjs` exports `addCriterion()` — appends a `- [ ]` line under
- [2026-07-26 00:14] (comment) ticked: Both reachable from the CLI (`t untick <id> <sel>`, `t criterion <id> "<text>"`)
- [2026-07-26 00:14] (comment) ticked: Criteria selectors are stable for a UI client: the API addresses a criterion
- [2026-07-26 00:14] (comment) ticked: `POST /api/projects/:key/tickets/:id/criteria` (add) and
- [2026-07-26 00:14] (comment) ticked: `POST /api/projects/:key/tickets` creates a ticket via `scaffoldNew()` —
- [2026-07-26 00:14] (comment) ticked: `server/server.test.mjs` covers every new endpoint incl. the refusal paths
- [2026-07-26 00:14] (comment) ticked: UI: acceptance checkboxes are live (click toggles, failure surfaces and reverts)
- [2026-07-26 00:14] (comment) ticked: UI: a New-ticket action creates in the current project and lands on the new
- [2026-07-26 00:14] (comment) ticked: Full suite green — `npm test` at the kit root, with the count cited in History
- [2026-07-26 00:14] (comment) @claude: Landed. Evidence: npm test green at the kit root - 739 assertions across 25 suites + 39 node:test cases, exit 0 (scripts (full comment #1 in ## Notes)
- [2026-07-26 00:14] (status) doing → review
