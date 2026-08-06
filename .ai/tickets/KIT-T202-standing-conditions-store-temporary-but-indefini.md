---
id: KIT-T202
title: standing conditions store — temporary-but-indefinite facts surfaced as callouts in the init prompt
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:33Z
updated: 2026-08-06T02:29:33Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (feature) State-of-the-union mechanism: standing conditions (temporary-but-indefinite facts like 'GitHub account of record is CSparks; depixeled-chris is locked pending recovery codes') need a home that is neither a permanent CLAUDE.md rule nor a ticket. Chris 2026-08-05: 'worth taking a look at whether we should implement a separate mechanism within KIT to support state of the union things like this. They are not meant to be permanent, but they can stick around as long as necessary, but should maybe be itemized and outlined as special callouts in the init prompt.' Wanted: an itemized store of active standing conditions, surfaced as explicit callouts by orient/SessionStart, each with an owner + a clearance condition (what makes it go away) so it is reviewable rather than forgotten. Origin incident: JV-Q003 + JV SESSION.md both still named the locked depixeled-chris account as the remote of record three weeks after the repo moved to CSparks.

Provenance: `.ai/inbox/triaged/2026-08-05-1545-state-of-the-union-mechanism-standing-conditions.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] standing conditions live in their own store with a clearance condition per item
- [ ] open conditions are surfaced as callouts at SessionStart, and a cleared one stops appearing
- [ ] the mechanism replaces the hand-maintained block in the private overlay (KIT-D046 stays the decision of record)

## Plan
1.

## History
- [2026-08-06 02:29] (created) feature — standing conditions store — temporary-but-indefinite facts surfaced as callouts in the init prompt
- [2026-08-06 02:31] (comment) criterion added: standing conditions live in their own store with a clearance condition per item
- [2026-08-06 02:31] (comment) criterion added: open conditions are surfaced as callouts at SessionStart, and a cleared one stops appearing
- [2026-08-06 02:31] (comment) criterion added: the mechanism replaces the hand-maintained block in the private overlay (KIT-D046 stays the decision of record)
