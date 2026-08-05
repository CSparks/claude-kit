---
id: KIT-T182
title: context7 usage-ledger hook — log every metered call, warn on KB-covered topics
type: feature
status: done
priority: medium
milestone:
labels: []
links: [KIT-D055]
files: []
supersedes:
superseded_by:
created: 2026-08-05T19:16:08Z
updated: 2026-08-05T19:27:18Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A PostToolUse hook matching mcp__*context7* appends one ledger line (UTC date, tool, library/query extract) per call to a machine-level ledger under ~/.claude — fires in ANY session, not gated on .ai/ presence (context7 spend is machine-wide)
- [x] Warn-only KB check: when the query names a library already indexed in the kit research/ KB index, emit a stderr warning citing the KB doc — never block (simple name match is fine; assertions loose, no tuning loop)
- [x] Fails open per the hook contract: malformed/missing payload exits 0 silently; test covers this
- [x] Tests in scripts/ mirror existing hook-test conventions and pass; plugin version bumped so the hook ships

## Plan
1.

## History
- [2026-08-05 19:16] (created) feature — context7 usage-ledger hook — log every metered call, warn on KB-covered topics
- [2026-08-05 19:16] (comment) criterion added: A PostToolUse hook matching mcp__*context7* appends one ledger line (UTC date, tool, library/query extract) per call to a machine-level ledger under ~/.claude — fires in ANY session, not gated on .ai/ presence (context7 spend is machine-wide)
- [2026-08-05 19:16] (comment) criterion added: Warn-only KB check: when the query names a library already indexed in the kit research/ KB index, emit a stderr warning citing the KB doc — never block (simple name match is fine; assertions loose, no tuning loop)
- [2026-08-05 19:16] (comment) criterion added: Fails open per the hook contract: malformed/missing payload exits 0 silently; test covers this
- [2026-08-05 19:16] (comment) criterion added: Tests in scripts/ mirror existing hook-test conventions and pass; plugin version bumped so the hook ships
- [2026-08-05 19:19] (status) todo → doing
- [2026-08-05 19:26] (comment) ticked: A PostToolUse hook matching mcp__*context7* appends one ledger line (UTC date, tool, library/query extract) per call to a machine-level ledger under ~/.claude — fires in ANY session, not gated on .ai/ presence (context7 spend is machine-wide)
- [2026-08-05 19:26] (comment) ticked: Warn-only KB check: when the query names a library already indexed in the kit research/ KB index, emit a stderr warning citing the KB doc — never block (simple name match is fine; assertions loose, no tuning loop)
- [2026-08-05 19:26] (comment) ticked: Fails open per the hook contract: malformed/missing payload exits 0 silently; test covers this
- [2026-08-05 19:26] (comment) ticked: Tests in scripts/ mirror existing hook-test conventions and pass; plugin version bumped so the hook ships
- [2026-08-05 19:27] (comment) @claude: evidence: hooks/context7-ledger.test.mjs — 23 passed, 0 failed; full npm test suite exit 0 (971+ assertions, 0 failed)
- [2026-08-05 19:27] (status) doing → done
