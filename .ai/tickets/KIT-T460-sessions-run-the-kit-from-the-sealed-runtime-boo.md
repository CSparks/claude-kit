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
### comment #3 [2026-10-13 22:54] @claude
CORRECTION (supersedes my earlier comment on this ticket). Verified 2026-10-13 by logging env and import.meta.url from compat-run inside live hook events of this session: CLAUDE_PLUGIN_ROOT=D:/dev/claude-kit, compat-run loaded from file:///D:/dev/claude-kit/hooks/compat-run.mjs; every hook fired exactly once per event and the harness labels the plugin claude-kit@inline, so --plugin-dir (profile.ps1 wrapper) wins over the installed claude-kit@claude-kit; the plugin-install link bootstrap sets is not what these sessions load. So the junction alone left hooks reading the live tree. Fix e9ffe72: hooks/compat-run.mjs is now a tiny launcher that loads compat-core.mjs and the hook scripts from ~/.claude/claude-kit-runtime/current/hooks (--live first arg or CLAUDE_KIT_LIVE=1 selects the working tree; unloadable published core falls back to live). hooks/compat-launcher.test.mjs 8 passed: broken working-tree core never runs, published core answers; mutation (drop the runtime lookup) fails 2. Live check after publish: a deliberately broken working-tree compat-core.mjs still exits 0 through the launcher. Registrations: hooks.json is read at session start. In this session the log shows no row-tag (in hooks.json for hours), nor upstream-gate, wait-poll, shell-writes, commit-stamp, so a NEW hooks.json entry needs a plugin reload (/reload-plugins per README/profile comment, untested by me) or restart; hook CODE changes reach every running session at the next event (my temporary log line did, same session, next call). Chris: (1) node D:\dev\claude-kit\bootstrap.mjs once, which rewrites the <kit> paths in ~/.claude/CLAUDE.md to current (that seals q/t/cap for agents) and relinks the plugin install; (2) reload plugins or restart sessions only to pick up the new hooks (reask-gate, row-tag, workflow-gate, resume-check, and for older sessions wait-poll, shell-writes, commit-stamp, upstream-gate); (3) the profile.ps1 $kit edit is now optional: it would also seal commands, agents, skills and hooks.json, but hooks and CLI no longer depend on it. bin/ shims still read the live tree.

## History
- [2026-10-13 21:07] (created) feature — sessions run the kit from the sealed runtime: bootstrap, dev-link and the composed CLAUDE.md point at runtime current
- [2026-10-13 22:28] (comment) @claude: (fixed) e5d8abd 8321d98. Test evidence: scripts/runtime-wiring.test.mjs 22 passed, scripts/is-main.test.mjs 5 passed (mutation: plain string compare fails 3); npm test green; published 571ce49
- [2026-10-13 22:28] (status) todo → review
- [2026-10-13 22:29] (comment) @claude: Switch is not live yet. Sessions here are launched by the PowerShell profile wrapper (Documents/WindowsPowerShell/profil (full comment #2 in ## Notes)
- [2026-10-13 22:54] (comment) @claude: CORRECTION (supersedes my earlier comment on this ticket). Verified 2026-10-13 by logging env and import.meta.url from c (full comment #3 in ## Notes)
