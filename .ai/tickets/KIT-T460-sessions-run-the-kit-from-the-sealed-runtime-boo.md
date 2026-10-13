---
id: KIT-T460
title: sessions run the kit from the sealed runtime: bootstrap, dev-link and the composed CLAUDE.md point at runtime current
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-13T21:07:10Z
updated: 2026-10-13T22:28:39Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T450
### comment #2 [2026-10-13 22:29] @claude
Switch is not live yet. Sessions here are launched by the PowerShell profile wrapper (Documents/WindowsPowerShell/profile.ps1: claude --plugin-dir D:\dev\claude-kit), so the installed plugin link bootstrap sets is not what they load. Chris-only steps: (1) node D:\dev\claude-kit\bootstrap.mjs (relinks the plugin install, statusline and composed CLAUDE.md to ~/.claude/claude-kit-runtime/current); (2) change $kit in profile.ps1 to $env:USERPROFILE\.claude\claude-kit-runtime\current; (3) restart sessions. Kit-side follow-up filed as KIT-T462 (bootstrap installs the wrapper from a kit source). Published copy: 571ce49.

## History
- [2026-10-13 21:07] (created) feature — sessions run the kit from the sealed runtime: bootstrap, dev-link and the composed CLAUDE.md point at runtime current
- [2026-10-13 22:28] (comment) @claude: (fixed) e5d8abd 8321d98. Test evidence: scripts/runtime-wiring.test.mjs 22 passed, scripts/is-main.test.mjs 5 passed (mutation: plain string compare fails 3); npm test green; published 571ce49
- [2026-10-13 22:28] (status) todo → review
- [2026-10-13 22:29] (comment) @claude: Switch is not live yet. Sessions here are launched by the PowerShell profile wrapper (Documents/WindowsPowerShell/profil (full comment #2 in ## Notes)
