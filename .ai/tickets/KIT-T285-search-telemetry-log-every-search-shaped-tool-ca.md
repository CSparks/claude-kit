---
id: KIT-T285
title: Search telemetry: log every search-shaped tool call (q, code-graph, Bash grep/rg, Grep tool, Glob) per project and session with kind (work store / code / docs), language filter, and whether a gate redirected it; weekly review and /standup show q+code-graph vs grep share and the top grep patterns that had no indexed answer
type: feature
status: review
priority: medium
milestone:
labels: []
links: [KIT-T101, KIT-T281]
files: []
supersedes:
superseded_by:
created: 2026-10-02T15:49:34Z
updated: 2026-10-02T15:52:52Z
---

## Description
hooks/search-telemetry.mjs (PostToolUse Bash|PowerShell|Grep|Glob) classifies via hooks/lib/search-shape.mjs and appends rows to ~/.claude/search-log/<project>.jsonl (hooks/lib/search-log.mjs, fail-open, silent); query-gate logs its blocks as event=blocked with the rule. scripts/search-report.mjs prints the mix, shares, the baseline, the most common unanswered grep shapes and patterns; --transcripts scans a transcript tree with the same classifier. Re-measured on stiletto transcripts (piped output filters excluded): q 230 (fts 142), code-graph 10, grep/rg 6936 (Rust/WGSL 3878), Grep tool 976, Glob 83, find 225, 267 gate blocks; top shapes identifier:rust 1976, regex:rust 1504, regex:any 1780. Shown in the weekly review (scripts/doc-review.mjs). Tests: hooks/search-telemetry.test.mjs (22).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] PostToolUse hook appends one row per search call to a per-project jsonl; fails open
- [x] Report script prints the 14-day mix and the most common unanswered grep shapes; baseline 2026-10-02 from stiletto transcripts (321 sessions incl. subagents): q 198 (fts 96), code-graph 9, Bash grep/rg 6,924 (4,181 Rust/WGSL-filtered, the KIT-T085 allowed path), Grep tool 976, query-gate blocks 267
- [x] Shown in the weekly review (KIT-T281) so the ratio is tracked over time

## Plan
1.

## History
- [2026-10-02 15:49] (created) feature — Search telemetry: log every search-shaped tool call (q, code-graph, Bash grep/rg, Grep tool, Glob) per project and session with kind (work store / code / docs), language filter, and whether a gate redirected it; weekly review and /standup show q+code-graph vs grep share and the top grep patterns that had no indexed answer
- [2026-10-02 15:49] (comment) criterion added: PostToolUse hook appends one row per search call to a per-project jsonl; fails open
- [2026-10-02 15:49] (comment) criterion added: Report script prints the 14-day mix and the most common unanswered grep shapes; baseline 2026-10-02 from stiletto transcripts (321 sessions incl. subagents): q 198 (fts 96), code-graph 9, Bash grep/rg 6,924 (4,181 Rust/WGSL-filtered, the KIT-T085 allowed path), Grep tool 976, query-gate blocks 267
- [2026-10-02 15:49] (comment) criterion added: Shown in the weekly review (KIT-T281) so the ratio is tracked over time
- [2026-10-02 15:50] (status) todo → doing
- [2026-10-02 15:52] (comment) ticked: PostToolUse hook appends one row per search call to a per-project jsonl; fails open
- [2026-10-02 15:52] (comment) ticked: Report script prints the 14-day mix and the most common unanswered grep shapes; baseline 2026-10-02 from stiletto transcripts (321 sessions incl. subagents): q 198 (fts 96), code-graph 9, Bash grep/rg 6,924 (4,181 Rust/WGSL-filtered, the KIT-T085 allowed path), Grep tool 976, query-gate blocks 267
- [2026-10-02 15:52] (comment) ticked: Shown in the weekly review (KIT-T281) so the ratio is tracked over time
- [2026-10-02 15:52] (status) doing → review
