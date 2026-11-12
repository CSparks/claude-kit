---
id: KIT-T1106
title: retrieval gate (source-discovery) blocks a cargo test pipeline whose grep filter contains an escaped double quote ('Ambiguous shell quoting'
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-12T19:49:40Z
updated: 2026-11-12T20:18:52Z
---

## Description
retrieval gate (source-discovery) blocks a cargo test pipeline whose grep filter contains an escaped double quote ('Ambiguous shell quoting'); the command searches no source, it filters test output, so the gate misfired; the block text names no way to filter output with a quoted pattern

kit-bug-shape: cap:bug:retrieval-gate-source-discovery-blocks-a-cargo-t
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Evidence: reproduced through hooks/query-gate.mjs with a cargo test pipeline whose filter pattern holds a backslash-escaped double quote (exit 2, Ambiguous shell quoting). Cause: query-gate called segments(cmd) without a shell, so the legacy test treated any escape before a quote as ambiguous. KIT-T941 already gave segments() a bash mode (a backslash escapes the next character outside single quotes); the KIT-T1096 here-string inertness lives in the shared inert-heredoc.mjs, so query-gate already had it. Fix d47dd06: query-gate passes shellOfTool(tool_name); the ambiguity block now prints the span and the single-quoted rewrite. PowerShell escapes stay ambiguous by design (backslash and backtick rules differ); the block names the single-quote form that is never ambiguous in either shell. Tests: query-gate 140 PASS (new: escaped-filter pipeline passes in Bash and with no tool name; single-quoted rewrite passes in Bash and PowerShell; controls: recursive source search and store search with escaped quotes still blocked, PowerShell escaped filter still blocked and names the span, a dollar-quote string still ambiguous); git-search 49, index-redirect 44, search-telemetry 22, block-triage 13, search-adoption 7 pass.

## History
- [2026-11-12 19:49] (created) bug — retrieval gate (source-discovery) blocks a cargo test pipeline whose grep filter contains an escaped double quote ('Ambiguous shell quoting'
- [2026-11-12 20:08] (landed) d47dd06 query-gate: a bash backslash-escaped quote inside a double-quoted filter pattern is a literal quote, so a cargo test pip
- [2026-11-12 20:18] (status) todo → review
- [2026-11-12 20:19] (comment) @claude-kit-agent: (fixed) d47dd06; query-gate 140 PASS
