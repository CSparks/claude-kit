---
id: KIT-T965
title: q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T964
superseded_by:
created: 2026-11-10T18:56:38Z
updated: 2026-11-10T18:56:38Z
---

## Description
q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep. Repro: q code 'kStepsPerBar\s*=' --regex --lang cpp --path src -> nothing, though src/core/Constants.h:27 defines it

kit-bug-shape: cap:bug:q-code-lang-cpp-misses-h-headers-they-index-as-l
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] q code --lang cpp covers headers (cpp+c family); --lang rust still excludes them

## Plan
1.

## History
- [2026-11-10 18:56] (created) bug — q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep
- [2026-11-11 02:21] (comment) criterion added: q code --lang cpp covers headers (cpp+c family); --lang rust still excludes them
