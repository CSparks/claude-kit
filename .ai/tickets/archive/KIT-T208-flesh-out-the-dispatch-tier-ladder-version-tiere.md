---
id: KIT-T208
title: Flesh out the dispatch tier ladder: version-tiered models (Opus 4.6/4.8 for basic/creative), effort reserved by task class
type: feature
status: done
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T16:21:14Z
updated: 2026-08-06T17:01:22Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Research doc distilled into kit research/ KB: community takes on model roles by version + effort levels, with sources
- [x] Proposed ladder presented via /decide questionnaire; chosen shape recorded as KIT-D061
- [x] config.yml tiers updated to the chosen ladder and propagated to adopted repos with dispatch blocks
- [x] Mechanics verified: how versioned model IDs (claude-opus-4-6/4-8) are actually pinnable in Claude Code dispatch (frontmatter vs Agent-tool param)

## Plan
1.

## History
- [2026-08-06 16:21] (created) feature — Flesh out the dispatch tier ladder: version-tiered models (Opus 4.6/4.8 for basic/creative), effort reserved by task class
- [2026-08-06 16:22] (comment) criterion added: Research doc distilled into kit research/ KB: community takes on model roles by version + effort levels, with sources
- [2026-08-06 16:22] (comment) criterion added: Proposed ladder presented via /decide questionnaire; chosen shape recorded as KIT-D061
- [2026-08-06 16:22] (comment) criterion added: config.yml tiers updated to the chosen ladder and propagated to adopted repos with dispatch blocks
- [2026-08-06 16:22] (comment) criterion added: Mechanics verified: how versioned model IDs (claude-opus-4-6/4-8) are actually pinnable in Claude Code dispatch (frontmatter vs Agent-tool param)
- [2026-08-06 16:22] (status) todo → doing
- [2026-08-06 16:27] (comment) ticked: Mechanics verified: how versioned model IDs (claude-opus-4-6/4-8) are actually pinnable in Claude Code dispatch (frontmatter vs Agent-tool param)
- [2026-08-06 16:27] (comment) @claude: Mechanics verified (claude-code-guide, doc-sourced): (1) agent frontmatter model: accepts FULL versioned IDs (claude-opu (full comment #1 in ## Notes)
### comment #1 [2026-08-06 16:27] @claude
Mechanics verified (claude-code-guide, doc-sourced): (1) agent frontmatter model: accepts FULL versioned IDs (claude-opus-4-6/4-8) — the sanctioned pinning surface; (2) Agent-tool per-invocation model param OVERRIDES frontmatter but is alias-only in current builds — versioned routing must live in frontmatter; (3) effort falls back silently to highest supported level (xhigh runs as high on 4.6; effort inert on haiku-4-5); (4) our KIT-T151 'model: opus' pins are ALIAS pins — they silently drifted 4.8 -> Opus 5 at v2.1.219; full IDs are the only real pin; (5) CLAUDE_CODE_SUBAGENT_MODEL env overrides param AND frontmatter — flattens the whole ladder if set; (6) retirement runway: 4.6 active >= Feb 2027, 4.7 >= Apr 2027, 4.8 >= May 2027; Opus 4.1 retired 2026-08-05.
- [2026-08-06 17:01] (comment) ticked: Research doc distilled into kit research/ KB: community takes on model roles by version + effort levels, with sources
- [2026-08-06 17:01] (comment) ticked: config.yml tiers updated to the chosen ladder and propagated to adopted repos with dispatch blocks
- [2026-08-06 17:01] (comment) @claude: Ladder shipped per KIT-D061 (AskUserQuestion, 4 answers): 9 tiers, full-id pins, 7 agents re-pinned (asset lane back on  (full comment #2 in ## Notes)
### comment #2 [2026-08-06 17:01] @claude
Ladder shipped per KIT-D061 (AskUserQuestion, 4 answers): 9 tiers, full-id pins, 7 agents re-pinned (asset lane back on fable/medium per Chris — supersedes KIT-T191), forensic regression staging, propagated to stiletto + inv4d3rs. Research distilled to research/model-routing-ladder-2026-08.md. Tests: dispatch-guard sweep updated to full-id invariant, model-tag expectations updated; npm test exit 0 (all suites green). KIT-T209 filed for scoped/ui pinned-agent scaffolds.
- [2026-08-06 17:01] (status) doing → done
- [2026-08-06 17:01] (comment) ticked: Proposed ladder presented via /decide questionnaire; chosen shape recorded as KIT-D061
