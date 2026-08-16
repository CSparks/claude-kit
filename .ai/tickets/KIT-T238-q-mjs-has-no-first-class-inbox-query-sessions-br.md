---
id: KIT-T238
title: q.mjs has no first-class inbox query — sessions brute-force `q sql "SELECT ... WHERE store='inbox'"` (stiletto session 2026-08-15: 3 raw…
type: feature
status: review
priority: medium
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
created: 2026-08-16T00:06:37.967Z
updated: 2026-08-16T00:25:53Z
---

## Description
q.mjs has no first-class inbox query — sessions brute-force `q sql "SELECT ... WHERE store='inbox'"` (stiletto session 2026-08-15: 3 raw SQL calls for enumerate-by-scope, filter-by-age, resolve-file-paths; Chris: "why the fuck are you brute forcing queries that should be handled as a claude kit feature?"). The store-grep gate correctly blocks file listing but the sanctioned surface has no matching verb, so the escape hatch becomes the norm. Root cause: gate landed without the query verb it forces traffic onto. Wants: `q inbox [scope] [--older-than Nd]` (age filters, file paths in output) + probably `q confirmations` for the ≥3d-needs-human-confirmation rule Chris set 2026-08-15.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] `q inbox [scope] [--older-than Nd]` lists untriaged captures with id, age, scope, type,
      title and the resolved file path; `all` widens to every project.
- [x] `q confirmations [scope]` is the same data with the fixed >=3d filter.
- [x] Both verbs answer identically on the markdown-scan (no-engine) path.
- [x] Registered in `q --help` and asserted by scripts/cli-help.test.mjs.
- [x] The query-gate's store-grep block message lists the new verbs.
- [x] Tests: scripts/q.test.mjs (fixture caps aged by filename stamp) — 71 passed.

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
Shaping/filtering lives in `scripts/q-inbox.mjs` so the cache path (q.mjs canned SQL) and the
markdown-scan path (q-fallback.mjs) share one implementation — the same parity discipline the
rest of the surface uses. Age comes from cap.mjs's `YYYY-MM-DD-HHMM-` filename stamp (survives a
copy/re-clone), falling back to the hydrated `source_files.mtime`; an item with neither signal
reports age `?` rather than 0. An id-less cap has no frontmatter title, so the row's title is the
first body line minus its `(type)` tag. Rows sort oldest-first — the confirmation queue reads
top-down. Test evidence: scripts/q.test.mjs 71 passed, scripts/cli-help.test.mjs 18 passed,
hooks/query-gate.test.mjs all pass, `npm test` clean.

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
- [2026-08-16 00:12] (status) todo → doing
- [2026-08-16 00:25] (status) doing → review
- [2026-08-16 00:25] (comment) q inbox / q confirmations landed (q-inbox.mjs, cache + scan parity, help + gate message); q.test.mjs 71 passed, cli-help 18 passed
