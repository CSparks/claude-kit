---
id: KIT-T326
title: Dispatch keeps landing straightforward work on opus 5.5 (2nd time; Chris 2026-10-04: 'if he's doing straightforward work, he should've been
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-04T22:49:08Z
updated: 2026-10-06T01:55:14Z
---

## Description
Dispatch keeps landing straightforward work on opus 5.5 (2nd time; Chris 2026-10-04: 'if he's doing straightforward work, he should've been using sonnet 5.5. Don't think your agent selection skills are keeping up with model capabilities'). Case: ST-T823/T824 crate-flatten (mechanical file moves through the broker) went to opus55, ran ~5h, ~210M cache-read tokens. Root causes: (1) stiletto .ai/config.yml carries a FORKED stale ladder (standard/careful/scoped/ui = claude-opus-4-8, no sonnet rung) diverging from kit ladder (standard = claude-sonnet-5-5) — one home, never a fork; (2) kit agents/patch-worker.md pins claude-sonnet-5-5 but is NOT registered as a subagent type in the session (only the skill is), so broker jobs fall back to opus55; (3) refactorer/test-author/implementer/code-reviewer/researcher still pin claude-opus-5, so picking a specialist lands on opus regardless; (4) the 2026-10-01 sonnet-default rule lives only in a memory + judgment — the dispatch-ladder hook checks fable inherit, not tier fit; (5) the 2026-10-01 'recurring model-to-duty review' feature capture sits un-triaged in the stiletto inbox, not the kit store.

kit-bug-shape: cap:bug:dispatch-keeps-landing-straightforward-work-on-o
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the ladder resolves from the kit config only (scripts/dispatch-ladder.mjs); a project `dispatch:` block is ignored and flagged by orient
- [x] stiletto carries no dispatch block and no model-pinned lane agents; the current lanes (sonnet55, opus55) ship from the kit
- [x] `claude-kit:patch-worker` is registered and dispatchable (root cause recorded)
- [x] refactorer, test-author, implementer repinned to claude-sonnet-5-5 (`standard` tier)
- [x] the model-to-duty review feature is a kit ticket linked from here (KIT-T339)
- [x] decision KIT-D079 records kit-only model routing
- [x] test: a project `dispatch:` block leaves the resolved tier unchanged and yields the drift warning

## Plan
1.

## History
- [2026-10-04 22:49] (created) bug — Dispatch keeps landing straightforward work on opus 5.5 (2nd time; Chris 2026-10-04: 'if he's doing straightforward work, he should've been
- [2026-10-06 01:36] (comment) @chris: Chris 2026-10-04, directive on scope: 'This should NOT be at a project level. Models are a moving target.' => model rout (full comment #1 in ## Notes)
### comment #1 [2026-10-06 01:36] @chris
Chris 2026-10-04, directive on scope: 'This should NOT be at a project level. Models are a moving target.' => model routing (ladder tiers, model-pinned lane agents) lives ONLY in the kit; projects carry no model choices.
- [2026-10-06 01:54] (comment) ticked: the ladder resolves from the kit config only (scripts/dispatch-ladder.mjs); a project `dispatch:` block is ignored and flagged by orient
- [2026-10-06 01:54] (comment) ticked: `claude-kit:patch-worker` is registered and dispatchable (root cause recorded)
- [2026-10-06 01:54] (comment) ticked: the model-to-duty review feature is a kit ticket linked from here (KIT-T339)
- [2026-10-06 01:54] (comment) ticked: test: a project `dispatch:` block leaves the resolved tier unchanged and yields the drift warning
- [2026-10-06 01:55] (comment) ticked: stiletto carries no dispatch block and no model-pinned lane agents; the current lanes (sonnet55, opus55) ship from the kit
- [2026-10-06 01:55] (comment) ticked: refactorer, test-author, implementer repinned to claude-sonnet-5-5 (`standard` tier)
- [2026-10-06 01:55] (comment) ticked: decision KIT-D079 records kit-only model routing
- [2026-10-06 01:55] (comment) @sonnet55: Landed ac99f4f (kit) + 0c40f341 (claude-kit-data: stiletto config.yml dispatch block removed, inbox capture moved out).  (full comment #2 in ## Notes)
### comment #2 [2026-10-06 01:55] @sonnet55
Landed ac99f4f (kit) + 0c40f341 (claude-kit-data: stiletto config.yml dispatch block removed, inbox capture moved out). Decision KIT-D079 (Chris 2026-10-04: 'This should NOT be at a project level. Models are a moving target.'). (1) Readers: no code read a project ladder; the 'reader' was the orchestrator following commands/work.md plus the project-template seed. New scripts/dispatch-ladder.mjs resolves tiers from the kit config only; orient flags a project dispatch: block as ignored drift; template carries none; work.md points at the resolver; agent-pins reuses readLadder. (2) Other project configs under D:/dev still carrying a dispatch: block (not edited): asset-forge, autoaudit, dirt-empire, fountain-previz, inv4d3rs, jollys-vinyl, marblequest, music-player, rapid-game-refactor, showtimewarp, woodshed. (3) Lanes: sonnet55 + opus55 now agents/ in the kit (generic bodies); stiletto copies of opus48/opus5/opus55/sonnet55 deleted (they were gitignored, no stiletto commit); material-specialist has no model pin, untouched. (4) patch-worker: source and manifest were already correct (KIT-T295, 0.1.18); the installed copy is current (cache 0.1.18, registry lastUpdated 2026-10-04 22:56); a session sees agent types only as of its start, so this session predates the registration. Plugin bumped 0.1.19 for the 3 new agents (implementer was untracked and unregistered; now both). agents/patch-worker.md also lacked the q-first section search-adoption requires; added. (5) Repinned refactorer, test-author, implementer to claude-sonnet-5-5 at effort high (standard tier). Candidates for review, left on claude-opus-5: code-reviewer, researcher, rg-ui-engineer, editor-workbench, audio-synthesist. (6) Review feature = KIT-T339. Tests: dispatch-ladder 11 passed (new; project dispatch block leaves resolved tier unchanged + orient drift warning), plugin-compat 110, agent-pins 14, search-adoption 7 (was 6+1 failing on patch-worker), broker suite 116, full npm test chain green up to server/server.test.mjs which fails pre-existing (express not installed, KIT-T290), remaining chain run separately all green.
- [2026-10-06 01:55] (status) todo → review
- [2026-10-06 02:07] (comment) @sonnet55: Correction: at ac99f4f sonnet55/opus55 lacked the tools: list plugin-compat requires once tracked; fixed in ca308c0 (plu (full comment #3 in ## Notes)
### comment #3 [2026-10-06 02:07] @sonnet55
Correction: at ac99f4f sonnet55/opus55 lacked the tools: list plugin-compat requires once tracked; fixed in ca308c0 (plugin-compat 114 passed). Index regeneration is blocked by a duplicate ticket id KIT-T317 (two files), unrelated; filed as a kit bug.
