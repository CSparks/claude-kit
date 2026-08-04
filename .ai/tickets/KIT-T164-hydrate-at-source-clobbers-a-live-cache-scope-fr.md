---
id: KIT-T164
title: hydrate-at-source clobbers a live cache scope from ANY .ai/ store on disk, not just tests. writeItemFile (hooks/lib.mjs:308) and ingest-data.mjs resolve the store via storeRoot() (lib.mjs:358), which returns the nearest ancestor holding .ai/config.yml — ANY directory anywhere qualifies, including a throwaway fixture in a temp/scratchpad dir. They then hydrate that root into defaultDbPath(), and hydrate replaces rows for whatever scope the store declares in ids.key. MEASURED 2026-08-02: a single Edit to a scratchpad fixture whose config declared ids.key KIT took the live KIT scope from openCount 56 to 1. No test suite involved — one file edit. KIT-T142 frames this as a test-isolation problem, but tests are only one caller; the real defect is that the scope key alone decides which rows are replaced, with no check that the store root is a REGISTERED/adopted project. Two roots claiming the same key means last-writer-wins, wholesale, silently. Repair is node scripts/hydrate-db.mjs. FIX DIRECTION: hydrate-at-source must verify the resolved storeRoot is a known adopted project root (registry lookup) before writing, and/or hydrate must key rows by resolved root path rather than trusting a self-declared ids.key.
type: bug
status: doing
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
created: 2026-08-02T21:53:15.863Z
updated: 2026-08-04T20:20:11Z
---

## Description
hydrate-at-source clobbers a live cache scope from ANY .ai/ store on disk, not just tests. writeItemFile (hooks/lib.mjs:308) and ingest-data.mjs resolve the store via storeRoot() (lib.mjs:358), which returns the nearest ancestor holding .ai/config.yml — ANY directory anywhere qualifies, including a throwaway fixture in a temp/scratchpad dir. They then hydrate that root into defaultDbPath(), and hydrate replaces rows for whatever scope the store declares in ids.key. MEASURED 2026-08-02: a single Edit to a scratchpad fixture whose config declared ids.key KIT took the live KIT scope from openCount 56 to 1. No test suite involved — one file edit. KIT-T142 frames this as a test-isolation problem, but tests are only one caller; the real defect is that the scope key alone decides which rows are replaced, with no check that the store root is a REGISTERED/adopted project. Two roots claiming the same key means last-writer-wins, wholesale, silently. Repair is node scripts/hydrate-db.mjs. FIX DIRECTION: hydrate-at-source must verify the resolved storeRoot is a known adopted project root (registry lookup) before writing, and/or hydrate must key rows by resolved root path rather than trusting a self-declared ids.key.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

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
- [2026-08-04 20:20] (status) todo → doing
