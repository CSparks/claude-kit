---
id: KIT-T964
title: q code --lang cpp excludes .h files (lang c), so a symbol defined only in a header returns no results and the agent falls back to grep; q sh
type: bug
status: superseded
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by: KIT-T965
created: 2026-11-10T18:56:32Z
updated: 2026-11-10T18:56:32Z
---

## Description
q code --lang cpp excludes .h files (lang c), so a symbol defined only in a header returns no results and the agent falls back to grep; q should treat cpp/c/h as one family for --lang cpp. Seen: q code 'kStepsPerBar\s*=' --lang cpp --path src returned nothing although src/core/Constants.h:27 defines it (GG-T202 session)

kit-bug-shape: cap:bug:q-code-lang-cpp-excludes-h-files-lang-c-so-a-sym
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:56] (created) bug — q code --lang cpp excludes .h files (lang c), so a symbol defined only in a header returns no results and the agent falls back to grep; q sh
- [2026-11-11 02:21] (status) todo → superseded (by KIT-T965)
