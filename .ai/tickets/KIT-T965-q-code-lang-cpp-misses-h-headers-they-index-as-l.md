---
id: KIT-T965
title: q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T964
superseded_by:
created: 2026-11-10T18:56:38Z
updated: 2026-11-11T02:29:42Z
fixed_commit: a19f1fa
---

## Description
q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep. Repro: q code 'kStepsPerBar\s*=' --regex --lang cpp --path src -> nothing, though src/core/Constants.h:27 defines it

kit-bug-shape: cap:bug:q-code-lang-cpp-misses-h-headers-they-index-as-l
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --lang cpp covers headers (cpp+c family); --lang rust still excludes them

## Plan
1.

## History
- [2026-11-10 18:56] (created) bug — q code --lang cpp misses .h headers (they index as lang c); a symbol defined only in a header returns no results and sends the agent to grep
- [2026-11-11 02:21] (comment) criterion added: q code --lang cpp covers headers (cpp+c family); --lang rust still excludes them
- [2026-11-11 02:22] (landed) a19f1fa hand-write-detect: a file git put back is no hand write (content equal to HEAD, or an earlier Edit's content in a call t
- [2026-11-11 02:26] (landed) 7c947bb code-index-lang-family test: explicit index path under the cache dir, tolerant cleanup (implements KIT-T965)
- [2026-11-11 02:29] (status) todo → review
- [2026-11-11 02:29] (comment) Fixed in a19f1fa (+7c947bb test fix); runtime publish refused: exported HEAD red on hooks/claim-release-controls.test.mjs (imports uncommitted hooks/lib/live-claims.mjs, KIT-T944 residual awaiting maintainer approval), so current has not moved
- [2026-11-11 02:30] (comment) ticked: q code --lang cpp covers headers (cpp+c family); --lang rust still excludes them
