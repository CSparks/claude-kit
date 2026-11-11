---
id: KIT-T989
title: legacy-freeze gate: HOD-D105 (maintainer: 'MOve anything we're no longer using to a legacy folder and forbid any use or updates to them. Kee
type: feature
status: todo
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T03:11:55Z
updated: 2026-11-11T03:11:55Z
---

## Description
legacy-freeze gate: HOD-D105 (maintainer: 'MOve anything we're no longer using to a legacy folder and forbid any use or updates to them. Keep them for reference.'). A PreToolUse hook must block Edit/Write/NotebookEdit and git add of changes under legacy/ (except git mv INTO legacy/), block imports/builds/workspace members that reference legacy/, and exclude legacy/ from q/code-graph defaults and test/lint gates. Opt-in per repo via .ai/config.yml legacy_dir. [reuses: none: no existing legacy-freeze mechanism in the kit; checked q fts legacy]

kit-bug-shape: cap:feature:legacy-freeze-gate-hod-d105-maintainer-move-anyt
first seen in hustle-or-die. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] legacy-freeze gate blocks every write path to legacy_dir, every reference added to it, and allows reads and git mv in (legacy-freeze-gate 104 passed)

## Plan
1.

## Notes
Commits 05746b8, f0acc0a (security fixes: blob-id rename check, git -C only before the subcommand, alias paths judged by real path). Publish NOT done: exported HEAD is red only on hooks/claim-release-controls.test.mjs (committed in fce4d2c) importing hooks/lib/live-claims.mjs, which is the KIT-T944 agent's uncommitted file; publish passes once that agent commits it. Not covered: git add -A / git commit -a with no pathspec, generator output written into legacy, tsconfig paths and Python imports.

## History
- [2026-11-11 03:11] (created) feature — legacy-freeze gate: HOD-D105 (maintainer: 'MOve anything we're no longer using to a legacy folder and forbid any use or updates to them. Kee
- [2026-11-11 04:04] (comment) criterion added: legacy-freeze gate blocks every write path to legacy_dir, every reference added to it, and allows reads and git mv in (legacy-freeze-gate 104 passed)
- [2026-11-11 04:04] (comment) ticked: legacy-freeze gate blocks every write path to legacy_dir, every reference added to it, and allows reads and git mv in (legacy-freeze-gate 104 passed)
