---
id: KIT-T386
title: q gap: 'fts' has no --project flag
type: bug
status: done
priority: high
milestone:
labels: [kit-bug, lapsed]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-07T19:25:31Z
updated: 2026-10-27T22:27:25Z
---

## Description
q fts deploy VPS --project jollys-vinyl

kit-bug-shape: q-gap:flag:fts:--project
first seen in jollys-vinyl. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] `q fts <terms> --project <name>` searches only that registered project (name or id key, any case, as cap resolves it)
- [x] Unknown project is an error (exit 1), not a fall-through; --scope with --project is rejected
- [x] q-gap and q --help know the flag; tested (q.test.mjs 109 passed, was 102)

## Plan
1.

## History
- [2026-10-07 19:25] (created) bug — q gap: 'fts' has no --project flag
- [2026-10-09 20:27] (comment) seen again in stiletto-2349: q fts sessionstart hook slow --project claude-kit
- [2026-10-09 20:54] (status) todo → doing
- [2026-10-09 20:57] (status) doing → review
- [2026-10-27 22:27] (status) review → done — lapsed: 14d in review, no maintainer feedback (KIT-D107)

## Notes
scripts/q-project.mjs resolves --project through cap-routing (matchProject over the registry), splitFts turns it into that project's scope so the cache and markdown-scan paths filter alike. Root cause found on the way: cap-routing's idKey regex required LF, so a CRLF config.yml (jollys-vinyl, the project in the report) had no key and no scope; idKey now delegates to id-utils readIdConfig, the reader the cache uses. Tests: scripts/q.test.mjs (+7: name, key/case, CRLF project, unknown, both flags, q-gap, CLI exit codes), cap.test 38 passed, cli-help 18, db-parity 21, kit-bug 15. Live: q fts deploy VPS --project jollys-vinyl -> JV-T012.
