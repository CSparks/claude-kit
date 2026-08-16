---
id: KIT-T236
title: Query tooling failure must be a hard stop-and-file: if code-graph/q ever errors or returns wrong results, file a bug immediately and spin…
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
created: 2026-08-16T00:06:37.055Z
updated: 2026-08-16T00:26:05Z
---

## Description
Query tooling failure must be a hard stop-and-file: if code-graph/q ever errors or returns wrong results, file a bug immediately and spin an agent to fix it (Chris, 2026-08-14). Live instance: 'code-graph --query defines' died with ENOENT on editor/algos/stiletto.ts (a path that no longer exists) plus a libuv assertion, and the session silently fell back to grep.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] A stale/missing file in the source list no longer crashes a build — it is skipped and
      reported on `graph.stale`.
- [x] The CLI exits non-zero with a named stale list + rebuild hint, so a caller sees failure
      rather than a short `[]`.
- [x] `code-graph status` works (it was parsed as a root → ENOENT scandir) and reports
      file/edge/symbol counts, mode, and stale entries; a bad root is a clear usage error.
- [x] Doctrine: the query-gate block messages and commands/drain.md state the hard-stop-and-file
      rule.
- [x] Tests: scripts/code-graph.test.mjs — 43 passed; hooks/query-gate.test.mjs all pass.

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
Code half done. Root cause of the live crash: `buildGraph` read every path git's file list
named, so a tracked-but-deleted file threw ENOENT mid-build (and took the WASM parser down with
it on Windows). The read is now per-file guarded; skipped entries land on `graph.stale` and every
CLI path reports them and exits 1 — a stale index must never answer as if it were complete.
`code-graph status` was never a verb, so it was taken as a repo root and died with
`ENOENT scandir '<cwd>/status'`; it is now a real verb, and any non-directory positional is a
usage error (exit 2) instead of a crash.

REMAINING (maintainer's): the governance line in the base CLAUDE.md — "a query-tooling failure
is a hard stop: file the bug, fix it, never fall back to grep". The doctrine is stated in the
query-gate block messages and commands/drain.md here; CLAUDE.md is not this agent's to edit.

Test evidence: scripts/code-graph.test.mjs 43 passed, hooks/query-gate.test.mjs all pass,
scripts/cli-help.test.mjs 18 passed, `npm test` clean.

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
- [2026-08-16 00:26] (status) doing → review
- [2026-08-16 00:26] (comment) code-graph skips+reports stale index entries and exits non-zero; status verb added; doctrine line in gate messages + drain.md. code-graph.test.mjs 43 passed
