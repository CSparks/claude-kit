---
id: KIT-T188
title: orient surfaces the plan-doc paths cited by open tickets, so a resume reads the plan of record instead of re-deriving it
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T189]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:20:08Z
updated: 2026-08-06T02:20:08Z
---

## Description
Half of a root cause captured 2026-08-06 (inbox 2026-08-06-0109). Open tickets cite their plan of
record — a design doc, a manifest, a submodule plan file — in `files:` or in the body. orient
replays the tickets, the roster, and SESSION.md at SessionStart, but never says "and the plan for
this work lives HERE". The lived cost: a session re-derived an editor architecture from another
project's tickets while the actual plan doc sat cited but unnamed.

This is the CHEAP half of the retrieval gap. KIT-T187 (indexing doc bodies for fts) is the
expensive half; naming the paths a resume should open needs no new index — the citations are
already in ticket frontmatter, and `q drift` already resolves ticket-named paths against the tree,
so the plumbing exists.

Sibling: KIT-T189 (out-of-repo sessions have no capture ratchet). The bug-shaped part of the same
capture shipped as KIT-T186.

Shape:
* Collect the paths cited by OPEN tickets (`files:` first; a body-path scan is a later refinement).
* Show them as a short "plan of record" block: path, the ticket citing it, and whether it EXISTS —
  a cited path that is gone is itself a finding (the capture's "partially in a submodule plan doc"
  case).
* Cap the list hard. orient is a briefing; twenty paths is noise, and a section that gets skipped
  is worse than one that does not exist.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] orient prints a bounded "plan of record" block: cited path, citing ticket id, exists/missing
- [ ] only OPEN tickets contribute, so the block shrinks as work closes
- [ ] a cited path that does not exist is flagged, not silently dropped
- [ ] the block is omitted entirely when no open ticket cites a path (no empty heading)
- [ ] a test asserts the block for a fixture with one present and one missing citation

## Plan
1. Reuse the citation collection behind `q drift` rather than re-reading tickets.
2. Render the block in the orient/survey output with a hard cap.
3. Test with a fixture carrying a present path and a missing one.

## History
- [2026-08-06 02:20] (created) feature — orient surfaces the plan-doc paths cited by open tickets, so a resume reads the plan of record instead of re-deriving it
