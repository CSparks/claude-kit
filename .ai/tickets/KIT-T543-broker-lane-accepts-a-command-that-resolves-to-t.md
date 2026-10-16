---
id: KIT-T543
title: broker lane accepts a command that resolves to the superproject workspace (rapid-game lane ran 'cargo t -p rg-physics' in the stiletto workspace)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T14:57:54Z
updated: 2026-10-16T16:49:42Z
---

## Description
mv9t5h60: 'cargo t -p rg-physics' without 'cd rust' ran in the stiletto workspace on the rapid-game lane. The lane should refuse at submit with a clear message, or root commands in its repo. Source: broker-vetting-2026-10-16 D7.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T516, KIT-T517, KIT-T522
### comment #1 [2026-10-16 16:49] @claude
Fixed: buildPatchJob refuses at submit a --test cargo command on a submodule lane whose root has no Cargo.toml and that neither cds nor passes --manifest-path, naming the fix (cd rust). lane-workspace.test.mjs 3 passed (refusal case red before; controls: cd, --manifest-path, non-cargo, superproject lane). Broker glob 316 passed. Limit: only --test commands are checked, not verify_default.

## History
- [2026-10-16 14:57] (created) bug — broker lane accepts a command that resolves to the superproject workspace (rapid-game lane ran 'cargo t -p rg-physics' in the stiletto workspace)
- [2026-10-16 16:49] (comment) @claude: Fixed: buildPatchJob refuses at submit a --test cargo command on a submodule lane whose root has no Cargo.toml and that  (full comment #1 in ## Notes)
- [2026-10-16 16:49] (status) todo → review
