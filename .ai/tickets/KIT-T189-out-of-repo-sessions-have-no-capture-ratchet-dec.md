---
id: KIT-T189
title: out-of-repo sessions have no capture ratchet — decisions made with no repo cwd never reach the affected project's store
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-T186, KIT-D068]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:20:08Z
updated: 2026-08-25T04:04:49Z
---

## Description
The third half of the root cause captured 2026-08-06 (inbox 2026-08-06-0109): a session started
OUTSIDE any repo — a home directory, a scratch dir — produced real design decisions that never
reached the affected project's store. The whole capture ratchet is `.ai`-relative and opt-in-aware:
the hooks find the nearest `.ai` above the cwd and no-op when there is none, so with no repo cwd
there is nothing to nudge, nothing to flush, and no default destination. The decision lived in chat
only, and the next session re-derived it wrongly.

`cap --project <name>` already routes from anywhere (the registry is machine-global), so the
CAPABILITY exists — what is missing is anything that INSISTS. Two separate gaps:
* the Stop-time ratchet and request-gate never fire, so nothing notices that a decision was made
  and not written down;
* there is no default destination, so even a willing agent must know `--project` and choose a
  target — which is precisely the choice that got made wrong (KIT-T186 covers the loudness of that
  misroute, and shipped).

Sibling halves: KIT-T187 (q blind to plan-of-record docs), KIT-T188 (orient surfaces cited plan
docs).

Design questions to settle first:
* WHERE does an out-of-repo decision go by default? Candidates: refuse with the project list (the
  KIT-T186 pattern, safe but blocking); a kit-level `unfiled/` tray that triage later routes; or
  infer from the session transcript's dominant project (KIT-T100 already indexes sessions, but
  inference is how the wrong project gets picked).
* Can a hook even RUN with no repo cwd? Machine-global hooks do (question-gate, dispatch-guard),
  so a Stop-time "you made a decision and captured nothing" nudge is possible — but it needs a
  detector that is honest about false positives, and a nudge that cannot be satisfied by writing
  to the wrong store is worse than none.
* Whatever the answer, an unfiled item must never sit outside the triage queue with no owner —
  the inbox=open-queue invariant (KIT-D036) has to keep holding.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the default destination for a no-repo-cwd capture is DECIDED and recorded as a decision
- [x] with no `.ai` above the cwd, a decision-shaped session still ends with a durable record or
      an explicit, visible refusal — never silence
- [x] whatever lands is reachable by triage (it is in a queue someone drains, not a dead drop)
- [x] no inference silently picks a project: an inferred target is stated and easy to correct
- [x] tests cover a no-repo-cwd run end to end, asserting where the record lands
- [x] an unbounded catch-all store exists at a configured path, standard .ai layout, created by the kit's own scaffold path
- [x] one shared resolution function (resolveStoreRoot) is used by cap, t, q, orient and flush — no per-tool copies
- [x] the commit gate stays repo-scoped: it does NOT fire outside a git repo / adopted store
- [x] captured items carry per-item topic: and session: identity; session comes from the SessionStart payload via the store's .session pointer
- [x] cap topic <slug> sets/changes the session topic; no silent auto-derivation
- [x] q topics prints a generated topic index and q --topic <slug> retrieves one topic's items
- [x] t move <id> <repo-path> promotes an item into a managed repo, preserving id/history and leaving a pointer

## Plan
1. Record the destination decision (refuse / unfiled tray / stated inference).
2. Implement the chosen path in cap plus whichever ratchet can run without a repo cwd.
3. Make triage aware of the new destination so nothing rots there.
4. Tests from a cwd with no `.ai` above it.

## Notes
Implemented 2026-08-25 as the unbounded catch-all store (KIT-D068).

Resolution: `hooks/lib/unbounded.mjs` → `resolveStoreRoot(start)` = `storeRoot(start)` else the
configured unbounded root. Entry points: `scripts/cap.mjs` (its private walk-up copy of
`storeRoot` is gone), `scripts/t.mjs`, `scripts/q.mjs`, `hooks/orient.mjs` (delegates to
`hooks/orient-unbounded.mjs`), `hooks/flush.mjs`. `hooks/commit-gate.mjs` is deliberately
untouched — it stays repo-scoped, asserted by a test.

Identity: `hooks/lib/session-identity.mjs` owns `<store>/.ai/.session` (gitignored). SessionStart
writes the harness `session_id` there; a changed session id clears the topic. `cap topic <slug>`
(`scripts/cap-topic.mjs`) is the only writer of a topic. Captures carry the fields as trailing
`topic:`/`session:` lines so the first line stays the title; `scripts/db-parse.mjs` reads them
from frontmatter OR the body, so a promoted item keeps its identity.

Retrieval: `scripts/q-topics.mjs`, wired as the scan-only verbs `topics` / `topic <slug>` (and the
`--topic <slug>` flag spelling), alongside `governing`/`drift`/`mentions`.
Promotion: `scripts/t-move.mjs`, `t move <id> <repo-path>`.

Tests: `scripts/unbounded.test.mjs` — 31 assertions, all green; registered in `npm test`.
`hooks/flush.test.mjs` grew the unbounded branch (14/14) and `scripts/cap.test.mjs`'s no-store
message assertion was updated (35/35). Full suite: 62/63 suites green, 1176 assertions.
The one red is `server/server.test.mjs` — `express` is not a declared dependency, pre-existing
and unrelated. `scripts/agent-pins.test.mjs` was excluded from the run: it fails on
`agents/rg-ui-engineer.md: no effort: pin`, the pre-existing issue captured at 1b72a1e — the
effort value is a firepower-ladder judgement, not this ticket's to pick.

Seeded end to end from the real `~` session 8df0fda7-13d9-4477-a0b2-035005e8bb80: five items
under topics `llm-rig` (3) and `comfy-volta` (2) in `claude-kit-data/unbounded/.ai/inbox/`.

Left open: `scripts/t.mjs` is 624 lines, past the 600-line hard gate — it was already 609
before this change, so the split is pre-existing debt, flagged rather than done mid-ticket.

## History
- [2026-08-06 02:20] (created) feature — out-of-repo sessions have no capture ratchet — decisions made with no repo cwd never reach the affected project's store
- [2026-08-25 03:41] (status) todo → doing
- [2026-08-25 03:41] (comment) picked up 2026-08-24: implementing the unbounded catch-all store per inbox 2026-08-25-0319 (kit-data/unbounded)
- [2026-08-25 03:41] (comment) criterion added: an unbounded catch-all store exists at a configured path, standard .ai layout, created by the kit's own scaffold path
- [2026-08-25 03:41] (comment) criterion added: one shared resolution function (resolveStoreRoot) is used by cap, t, q, orient and flush — no per-tool copies
- [2026-08-25 03:41] (comment) criterion added: the commit gate stays repo-scoped: it does NOT fire outside a git repo / adopted store
- [2026-08-25 03:41] (comment) criterion added: captured items carry per-item topic: and session: identity; session comes from the SessionStart payload via the store's .session pointer
- [2026-08-25 03:41] (comment) criterion added: cap topic <slug> sets/changes the session topic; no silent auto-derivation
- [2026-08-25 03:41] (comment) criterion added: q topics prints a generated topic index and q --topic <slug> retrieves one topic's items
- [2026-08-25 03:41] (comment) criterion added: t move <id> <repo-path> promotes an item into a managed repo, preserving id/history and leaving a pointer
- [2026-08-25 04:04] (comment) ticked: the default destination for a no-repo-cwd capture is DECIDED and recorded as a decision
- [2026-08-25 04:04] (comment) ticked: with no `.ai` above the cwd, a decision-shaped session still ends with a durable record or
- [2026-08-25 04:04] (comment) ticked: whatever lands is reachable by triage (it is in a queue someone drains, not a dead drop)
- [2026-08-25 04:04] (comment) ticked: no inference silently picks a project: an inferred target is stated and easy to correct
- [2026-08-25 04:04] (comment) ticked: tests cover a no-repo-cwd run end to end, asserting where the record lands
- [2026-08-25 04:04] (comment) ticked: an unbounded catch-all store exists at a configured path, standard .ai layout, created by the kit's own scaffold path
- [2026-08-25 04:04] (comment) ticked: one shared resolution function (resolveStoreRoot) is used by cap, t, q, orient and flush — no per-tool copies
- [2026-08-25 04:04] (comment) ticked: the commit gate stays repo-scoped: it does NOT fire outside a git repo / adopted store
- [2026-08-25 04:04] (comment) ticked: captured items carry per-item topic: and session: identity; session comes from the SessionStart payload via the store's .session pointer
- [2026-08-25 04:04] (comment) ticked: cap topic <slug> sets/changes the session topic; no silent auto-derivation
- [2026-08-25 04:04] (comment) ticked: q topics prints a generated topic index and q --topic <slug> retrieves one topic's items
- [2026-08-25 04:04] (comment) ticked: t move <id> <repo-path> promotes an item into a managed repo, preserving id/history and leaving a pointer
- [2026-08-25 04:04] (status) doing → review
- [2026-08-25 04:04] (comment) unbounded store shipped; 31 new assertions in scripts/unbounded.test.mjs, suite 62/63 green (server/express + agent-pins reds pre-existing)
