---
id: KIT-T193
title: test isolation gap: db-cache.test.mjs and reconcile-central.test.mjs write the LIVE cache
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:15Z
updated: 2026-08-06T02:29:15Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (bug) test isolation gap: scripts/db-cache.test.mjs and scripts/reconcile-central.test.mjs still write the LIVE .cache/workflow.db. Measured 2026-08-04 by stat-ing .cache/workflow.db mtime around each suite in isolation: db-cache.test.mjs and reconcile-central.test.mjs both change it; hydrate-at-source, session-ingest, begin-task, t, sync-tasks and triage all leave it byte-identical. The live KIT scope SURVIVES intact (222 items / 66 open before and after), so this is a re-hydrate rather than the KIT-T142 scope-replacement corruption - but it violates the KIT-T142/T164 rule that a suite must never hydrate or touch the live cache, and it is the same shape as the failure that once replaced the live KIT scope with a temp fixture. Fix: give both suites a temp dbPath and CLAUDE_PLUGIN_ROOT the way scripts/q.test.mjs does. Pre-existing - not introduced by KIT-T110/T169/T126.

Provenance: `.ai/inbox/triaged/2026-08-04-1645-test-isolation-gap-scripts-db-cache-test-mjs-and.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] db-cache.test.mjs and reconcile-central.test.mjs leave .cache/workflow.db byte-identical, like the other suites
- [ ] the isolation is structural (an injected dbPath/plugin root), not a cleanup step that can be skipped

## Plan
1.

## History
- [2026-08-06 02:29] (created) bug — test isolation gap: db-cache.test.mjs and reconcile-central.test.mjs write the LIVE cache
- [2026-08-06 02:30] (comment) criterion added: db-cache.test.mjs and reconcile-central.test.mjs leave .cache/workflow.db byte-identical, like the other suites
- [2026-08-06 02:30] (comment) criterion added: the isolation is structural (an injected dbPath/plugin root), not a cleanup step that can be skipped
