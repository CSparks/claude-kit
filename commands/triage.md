---
description: Drain the inbox into tickets/questions/decisions and report a prioritized worklist
model: sonnet
---
Cross-project triage runs in lockstep with `scripts/triage.mjs` — the SCRIPT gathers and
applies; you (the LLM) only classify the irreducible-prose caps in between. Do NOT scan the
inbox or the stores by hand; the script already did.

1. **GATHER** — run `node <kit>/scripts/triage.mjs --plan --json`. Triage is ALWAYS
   cross-project (KIT-D026): run with NO `--scope` so it drains every project's inbox in
   one pass. Add `--scope <KEY>` ONLY when the maintainer explicitly names one project to
   confine to — never narrow it unbidden. It opens the cache ONCE, reads every
   `store='inbox'` cap cross-project, and emits a plan: per cap `{capId, scope, text,
   type, route, priority, needsClassification, dedupCandidates, allowedClassifications,
   provenance}`.

   **Backward-provenance inference (KIT-T065).** For a bug/regression cap (which always
   arrives with EMPTY provenance — an inbox cap carries none), the script ALSO attaches
   `provenance: { candidates, evidence }` — its proposal for the change that CAUSED the
   bug, derived mechanically from the symptom text: implicated files (code-graph) →
   governing ticket/decision (`q governing`, the candidate `regressed_from`) → the commits
   that touched those files (`git log`, the candidate `causing_commit`). Each candidate is
   `{ file, regressed_from, governing, causing_commit, commit, source }` — the file it rests
   on, the governing item, and the commit, so the guess is auditable. It is FAIL-OPEN: a
   cold code-graph/`q` cache, no git history, or a symptom that names no file yields
   `candidates: []` — never a block, never a throw. Non-bug caps carry `provenance: null`.

2. **CLASSIFY** — build `decisions.json` (an array). For each plan item:
   - `needsClassification: false` (DETERMINISTIC — it had an explicit `(type)`): auto-include
     it unchanged — `{capId, classification: type, route, priority, action: "create"}`. No LLM
     judgment needed.
   - `needsClassification: true` (AMBIGUOUS prose): pick ONE classification from THIS cap's
     `allowedClassifications`, considering its `dedupCandidates`. PURE text classification —
     do NOT open files or chase references. Choose an `action`:
       - `create` — a new item (the default).
       - `fold` — it belongs to an existing item; set `target: <id>` (append a dated note).
       - `supersede` — it RETIRES an existing item; set `target: <old-id>` (the script sets
         `supersedes`/`superseded_by` and writes the new item).
       - `skip` — noise; nothing is written.
     Optional `links: [<id>...]`. The script resolves `route`/`priority` from config for caps
     where you omit them; pass them only to override.

   **A cap that quotes the maintainer is a decision, not a ticket (KIT-T938).** The plan lists
   caps that read as rulings (verbatim, ruling, directive, "<name> said", a quoted sentence).
   Promote each to a decision before the apply step: `t decide --file <draft.md> --from <cap id>`
   (the `**Maintainer:**` paragraph holds his words verbatim; the cap moves to `inbox/triaged/`).
   A cap that only looks like one is `skip` (or `t triage <cap id> --skip`).

   **Presenting + accepting provenance candidates (bug/regression caps only).** When a cap
   carries `provenance.candidates`, surface the strongest one to the maintainer as a
   PROPOSAL — never silently authoritative — e.g. *"BUG-024: likely caused by `6712903`
   (Merge … integrated ground mesh), governed by HOD-D015; accept?"* — citing the evidence
   (the file, the governing item, the commit subject). On accept, attach a `provenance`
   object to that cap's decision so the link lands in the new item's frontmatter:
       `provenance: { regressed_from: "<id>", causing_commit: "<sha>", mark: "inferred" }`
   `mark` is `inferred` for an accepted machine guess (the default — an auditable proposal)
   or `given` for a culprit the MAINTAINER named directly (not from the candidate list).
   Pass only the fields that were accepted; omit `provenance` entirely to record none. NEVER
   invent a `causing_commit`/`regressed_from` — it must come from a candidate or the
   maintainer. A wrong `inferred` link is recoverable precisely because the marker flags it.

3. **APPLY** — run `node <kit>/scripts/triage.mjs --apply decisions.json`. It allocates ids
   with `next-id` (NEVER hand-pick — KIT-T009), writes each item from its store's
   `_TEMPLATE.md`, folds/supersedes as directed, MOVES every processed cap to `inbox/triaged/`
   (never deletes), re-syncs the cache, and prints cross-project receipts + a drain-ordered
   worklist per scope.

This is triage only — do not start implementing the promoted work.
