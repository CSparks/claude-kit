---
id: KIT-T286
title: q capability-miss pipeline: q auto-files a KIT gap on an unknown query or unsupported filter; the search-telemetry hook files one when a grep follows an empty/failed q for the same terms; gaps are deduped by shape, tagged q-gap, and orient lists open q-gap tickets as dispatch-now items
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:58:55Z
updated: 2026-10-02T16:17:19Z
---

## Description
scripts/kit-bug.mjs files deduped tickets (shape marker, one open ticket per shape, recurrence appended to History; kind bug or feature -> label kit-bug / kit-feature) into the registry project claude-kit (CLAUDE_KIT_BUG_STORE overrides; none = nothing filed). Sources wired: q unknown verb and unsupported flag (scripts/q-gap.mjs; q prints 'Filed as KIT-T..'), a grep within 5 calls after an empty/failed q on overlapping terms (hooks/lib/q-miss.mjs via search telemetry), hook crashes or fail-open announcements (hooks/compat-run.mjs reportHookCrash), and cap bug/feature into the kit store (scripts/cap-dedup.mjs asKitBug). orient lists open kit-bug/kit-feature tickets under DISPATCH NOW. Base contract source user-config/CLAUDE.global.md gained the rule (bugs and features, from any session, agent dispatched in the claude-kit checkout). Not built: auto-filing on a gate block overridden by an exclusion (would file on every legitimate exclusion). Tests: scripts/kit-bug.test.mjs (14). Suite: 71 ok, 2 pre-existing environment failures (agent-pins: untracked agents/implementer.md; server: express missing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q on an unknown query or unsupported flag writes one deduped KIT inbox gap (shape, example, project) and says so in its output
- [x] Telemetry hook: grep within N calls after an empty/failed q on overlapping terms files a q-gap with both commands
- [x] orient lists open q-gap tickets under a dispatch-now heading; tests for each path

## Plan
1.

## History
- [2026-10-02 15:58] (created) feature — q capability-miss pipeline: q auto-files a KIT gap on an unknown query or unsupported filter; the search-telemetry hook files one when a grep follows an empty/failed q for the same terms; gaps are deduped by shape, tagged q-gap, and orient lists open q-gap tickets as dispatch-now items
- [2026-10-02 15:58] (comment) criterion added: q on an unknown query or unsupported flag writes one deduped KIT inbox gap (shape, example, project) and says so in its output
- [2026-10-02 15:58] (comment) criterion added: Telemetry hook: grep within N calls after an empty/failed q on overlapping terms files a q-gap with both commands
- [2026-10-02 15:58] (comment) criterion added: orient lists open q-gap tickets under a dispatch-now heading; tests for each path
- [2026-10-02 15:59] (comment) @claude: Scope widened by Chris 2026-10-02: the pipeline covers ANY kit bug, not only q gaps. Auto-capture sources: q capability  (full comment #1 in ## Notes)
### comment #1 [2026-10-02 15:59] @claude
Scope widened by Chris 2026-10-02: the pipeline covers ANY kit bug, not only q gaps. Auto-capture sources: q capability misses, hook/script errors (non-zero exit, parse failures), gate blocks later overridden by an exclusion or reported as false positive, cap of a 'bug' into the KIT store. All become tickets directly (not inbox), tagged kit-bug, and orient lists open kit-bug tickets as dispatch-now. Base contract gains the rule.
- [2026-10-02 16:08] (comment) @claude: Exception Chris 2026-10-02: covers needed kit FEATURES too, not only bugs — from any session, logged straight to KIT tic (full comment #2 in ## Notes)
### comment #2 [2026-10-02 16:08] @claude
Exception Chris 2026-10-02: covers needed kit FEATURES too, not only bugs — from any session, logged straight to KIT tickets and dispatched immediately unless directed otherwise. Put that wording in the base contract.
- [2026-10-02 16:17] (comment) ticked: q on an unknown query or unsupported flag writes one deduped KIT inbox gap (shape, example, project) and says so in its output
- [2026-10-02 16:17] (comment) ticked: Telemetry hook: grep within N calls after an empty/failed q on overlapping terms files a q-gap with both commands
- [2026-10-02 16:17] (comment) ticked: orient lists open q-gap tickets under a dispatch-now heading; tests for each path
- [2026-10-02 16:17] (status) todo → review
