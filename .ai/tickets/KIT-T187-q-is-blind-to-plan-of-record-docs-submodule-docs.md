---
id: KIT-T187
title: q is blind to plan-of-record docs — submodule docs/ and the plan files tickets cite are not indexed by fts
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T188]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:20:07Z
updated: 2026-08-06T02:20:07Z
---

## Description
Half of a root cause captured 2026-08-06 (inbox 2026-08-06-0109). An editor-architecture design
(files-not-windows hosting, never embed the game, per-game manifest) lived in an out-of-repo
session's chat and PARTIALLY in a plan doc inside a submodule's `docs/`. `q fts` indexes the `.ai`
stores and the research KB (KIT-D004/D056) — not a submodule's `docs/`, and not another project's
plan files. So the next session searched, found nothing, and re-derived the direction WRONGLY from
a different project's tickets. A doc that a ticket cites as its plan of record but that no query
surface can reach is, for retrieval purposes, not written down at all.

The store-grep gate makes this sharper: agents are BLOCKED from grepping and sent to `q`, so
whatever `q` cannot see is invisible in practice, not merely slower to find.

Sibling halves of the same capture: KIT-T188 (orient surfaces plan-doc paths cited by open
tickets) and KIT-T189 (out-of-repo sessions have no capture ratchet). The bug-shaped part of that
capture shipped as KIT-T186.

Design questions to settle before building:
* WHICH docs — every `*.md` under a repo (too much: node_modules, vendor, generated), or an
  explicit opt-in list (`docs.paths` in .ai/config.yml), or exactly the paths tickets cite in
  their `files:`/body? The cited-paths option is self-limiting and needs no new config.
* Submodules and sibling repos are OUTSIDE the project root — indexing them means the doc rows
  carry a repo-relative path plus which repo they came from, and staleness has to be detected per
  source (the cache manifest is per-scope today).
* A doc has no id, status, or history, so it is not an `items` row. A separate `docs` table (path,
  repo, title, body) keeps the item model clean and the FTS index shared.
* Read-only by definition: no mutation path, no ids minted, hydrate-only — a doc is evidence, not
  a work item.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] the doc set is defined by an explicit, reviewable rule (decision recorded), not a
      whole-tree markdown sweep
- [ ] `q fts` returns hits from plan-of-record docs, labelled as docs and distinguishable from
      work items in the output
- [ ] a doc inside a git SUBMODULE of the project is reachable, with its source repo named
- [ ] staleness is detected: editing a doc makes the cache report stale and rehydrate
- [ ] the markdown-scan fallback answers doc queries too (cache stays an accelerator, KIT-T031)
- [ ] no ids are minted and no doc is ever written by the indexer
- [ ] tests cover: a submodule doc found by fts, a doc edit detected as stale, and the fallback
      path returning the same rows

## Plan
1. Decide the doc-set rule (cited paths vs configured paths) and record it as a decision.
2. Add a `docs` table + FTS to the cache; hydrate from the resolved doc set per scope.
3. Extend `q fts` output with a doc row shape; mirror it in q-fallback.
4. Tests per the criteria.

## History
- [2026-08-06 02:20] (created) feature — q is blind to plan-of-record docs — submodule docs/ and the plan files tickets cite are not indexed by fts
