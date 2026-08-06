---
id: KIT-T189
title: out-of-repo sessions have no capture ratchet — decisions made with no repo cwd never reach the affected project's store
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T186]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:20:08Z
updated: 2026-08-06T02:20:08Z
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
- [ ] the default destination for a no-repo-cwd capture is DECIDED and recorded as a decision
- [ ] with no `.ai` above the cwd, a decision-shaped session still ends with a durable record or
      an explicit, visible refusal — never silence
- [ ] whatever lands is reachable by triage (it is in a queue someone drains, not a dead drop)
- [ ] no inference silently picks a project: an inferred target is stated and easy to correct
- [ ] tests cover a no-repo-cwd run end to end, asserting where the record lands

## Plan
1. Record the destination decision (refuse / unfiled tray / stated inference).
2. Implement the chosen path in cap plus whichever ratchet can run without a repo cwd.
3. Make triage aware of the new destination so nothing rots there.
4. Tests from a cwd with no `.ai` above it.

## History
- [2026-08-06 02:20] (created) feature — out-of-repo sessions have no capture ratchet — decisions made with no repo cwd never reach the affected project's store
