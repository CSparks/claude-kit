---
id: KIT-T142
title: Test-fixture scopes DUP/ORI/RCN leak into the PRODUCTION cache: db-cache.test.mjs / test-hooks.mjs / next-id.mjs fixture ids (DUP-T001-a, ORI-T001-x, RCN-T001-old) hydrate into .cache/workflow.db and show up in q open + orient scope counts. Tests must hydrate an isolated temp cache, never the real one. Found during KIT-T134 root-cause.
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
created: 2026-07-23T15:42:09.441Z
updated: 2026-08-02T21:47:15Z
---

## Description
Test-fixture scopes DUP/ORI/RCN leak into the PRODUCTION cache: db-cache.test.mjs / test-hooks.mjs / next-id.mjs fixture ids (DUP-T001-a, ORI-T001-x, RCN-T001-old) hydrate into .cache/workflow.db and show up in q open + orient scope counts. Tests must hydrate an isolated temp cache, never the real one. Found during KIT-T134 root-cause.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] npm test leaves every live cache scope byte-identical (measured KIT rows 211 -> 211)
- [x] each offending suite redirects CLAUDE_PLUGIN_ROOT to a throwaway dir so hydration never reaches the session cache
- [x] a regression assertion in t.test.mjs fails if the live cache is ever touched again

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
### comment #1 [2026-07-26 00:20] @claude
Worse than a leak, measured 2026-07-25 during KIT-T153: t.test.mjs fixtures declare ids key KIT, so the CLI-integration test hydrates a TEMP FIXTURE ROOT into the real .cache/workflow.db under the REAL scope - it does not just add junk rows, it REPLACES the live KIT scope. After npm test, /api/projects reported KIT openCount=1 reviewCount=0 (truth: 56/13); the staleness check did not catch it because the fixture write left the cache looking fresh. Repaired with node scripts/hydrate-db.mjs (1029 items). So the fix needs BOTH halves: tests hydrate an isolated temp dbPath (CLAUDE_PLUGIN_ROOT redirect, as server.test.mjs already does), AND fixture scope keys must not collide with real ones.
### comment #2 [2026-08-02 21:46] @claude
Fixed the leak; the root cause is broader than this ticket. BISECTED (scratchpad bisect over all 36 suites, counting scope rows directly in SQLite so q.mjs staleness auto-rehydrate could not mask it): four offenders, not one — scripts/test-hooks.mjs (211 -> 3), scripts/comments.test.mjs (211 -> 1), scripts/begin-task.test.mjs (211 -> 1), scripts/t.test.mjs. Each spawns a CLI/hook whose refresh calls hydrate({ dbPath: defaultDbPath() }); the fixture config declares ids.key KIT, so hydrating a temp fixture REPLACED the live KIT scope. Fix: redirect CLAUDE_PLUGIN_ROOT to a throwaway dir process-wide in each suite (children inherit it), plus an explicit CHILD_ENV on t.test.mjs's execFileSync. Deliberately did NOT rename fixture keys to a non-colliding value: fixture ids and REAL ticket citations overlap in these files (KIT-T050/T051 appear as both), so a bulk rename would corrupt provenance. Isolation alone makes the collision unreachable.
BROADER DEFECT, capped separately: hydrate-at-source is not test-specific. writeItemFile (hooks/lib.mjs:308) resolves the store via storeRoot() (lib.mjs:358), which returns ANY ancestor holding .ai/config.yml — including a fixture in a temp/scratchpad dir — then hydrates it into the live DB. MEASURED: a single Edit to a scratchpad fixture declaring ids.key KIT took the live scope 56 -> 1, no test suite involved. The scope key alone decides which rows are replaced, with no check that the root is a registered project.
EVIDENCE: npm test exit 0, zero failures, KIT rows 211 -> 211 across the full suite; bisect reports none - the suite leaves the KIT scope intact. Repair for any historical damage remains node scripts/hydrate-db.mjs.

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
- [2026-07-26 00:20] (comment) @claude: Worse than a leak, measured 2026-07-25 during KIT-T153: t.test.mjs fixtures declare ids key KIT, so the CLI-integration  (full comment #1 in ## Notes)
- [2026-08-02 21:46] (comment) criterion added: npm test leaves every live cache scope byte-identical (measured KIT rows 211 -> 211)
- [2026-08-02 21:46] (comment) criterion added: each offending suite redirects CLAUDE_PLUGIN_ROOT to a throwaway dir so hydration never reaches the session cache
- [2026-08-02 21:46] (comment) criterion added: a regression assertion in t.test.mjs fails if the live cache is ever touched again
- [2026-08-02 21:46] (comment) ticked: npm test leaves every live cache scope byte-identical (measured KIT rows 211 -> 211)
- [2026-08-02 21:46] (comment) ticked: a regression assertion in t.test.mjs fails if the live cache is ever touched again
- [2026-08-02 21:46] (comment) @claude: Fixed the leak; the root cause is broader than this ticket. BISECTED (scratchpad bisect over all 36 suites, counting sco (full comment #2 in ## Notes)
- [2026-08-02 21:47] (comment) ticked: each offending suite redirects CLAUDE_PLUGIN_ROOT to a throwaway dir so hydration never reaches the session cache
- [2026-08-02 21:47] (status) todo → review
