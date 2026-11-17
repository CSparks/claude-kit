---
id: KIT-T1355
title: process failure: ran grep on a named build-output file in the repo (one-file-search gate); prevention: filter the command's own output inlin
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T21:44:53Z
updated: 2026-11-17T21:50:48Z
---

## Description
process failure: ran grep on a named build-output file in the repo (one-file-search gate); prevention: filter the command's own output inline or Read the file

kit-bug-shape: cap:bug:process-failure-ran-grep-on-a-named-build-output:b7913105
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Block text: a log or build-output path (.log .txt .out .err or under target/) now leads with 'FIRST: read it with the Read tool, or filter the producing command inline' before the q form (hooks/lib/one-file-search.mjs). Test hooks/query-gate-build-log.test.mjs 5 passed, query-gate and query-gate-pipes all pass. Cache state: installed_plugins.json records claude-kit@claude-kit 0.1.55; cache dirs 0.1.51..0.1.56 under plugins/cache/claude-kit/claude-kit are empty, so the KIT-T1348 agent preamble (plugin 0.1.56, published 35a92431) has NOT reached a session; the loaded agent text (this agent's own) lacks it. Needs a plugin update or restart by the maintainer; no check loosened.

## History
- [2026-11-17 21:44] (created) bug — process failure: ran grep on a named build-output file in the repo (one-file-search gate); prevention: filter the command's own output inlin
- [2026-11-17 21:50] (status) todo → review
