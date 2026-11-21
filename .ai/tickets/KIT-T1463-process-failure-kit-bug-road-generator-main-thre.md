---
id: KIT-T1463
title: process failure + kit bug (road-generator main thread, 2026-11-21): the context preload does not carry tooling rules and big process rules p
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-21T13:38:37Z
updated: 2026-11-21T13:51:06Z
---

## Description
process failure + kit bug (road-generator main thread, 2026-11-21): the context preload does not carry tooling rules and big process rules prominently, so the same ones are broken repeatedly: shell greps of named files by implementer/perf agents (five in one run although every definition carries the rule), ticket/decision/run ids in replies to the maintainer, a stated directive not recorded the turn it was said. Maintainer: 'I think there is something wrong in the context preload that is not either raising those things prominently enough or it's just not mentioned at all. Tooling in big process rules should always get prominent placement there.' Audit orient output + CLAUDE.global.md + SubagentStart guide: where each rule lives, whether it survives compaction and reaches agents, what pushes it down. Build a short fixed top-of-preload block of tooling and big process rules (one line each), restated after compaction and copied into agent briefs and definitions; trim listings not rules to stay under the size ceiling; add a check that the block is present at the top of orient output and in every agent definition. Project record: road-generator decision on prominent preload placement (just written).

kit-bug-shape: cap:bug:process-failure-kit-bug-road-generator-main-thre:295532dd
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] fixed top block of tooling and process rules is first in orient (bounded and unbounded), in the SubagentStart hand and in every agent definition, with a check (rule-block.test.mjs 27 passed)
- [x] preload stays under the 25k ceiling by trimming listings (19798 of 25000), and t decide prints the add-to-block step

## Plan
1.

## Notes
AUDIT (measured before the block; scripts/context-budget.mjs, road-generator: 19353 of 25000 tokens; global CLAUDE.md 9170, project CLAUDE.md 4240, orient output 2364 (hard cap 9500 chars, hooks/lib/orient-budget.mjs), skill+agent listings 2741). The listings that bloat the preload are the two CLAUDE.md files, not orient. Where each rule lived: search rules = global CLAUDE.md (system prompt; the harness reloads it after compaction) + orient's one 'QUERY don't grep' line as the LAST block + each agent definition's Search section in the last 15% of the file; no implicit tests / no waiting loops = global CLAUDE.md + agent definitions' bottom sections, absent from orient; plain words = nowhere before KIT-T1462; summary above questionnaire = global CLAUDE.md only (orient: 'Questions -> AskUserQuestion' near the end); anything needed is a questionnaire = global CLAUDE.md + prose-ask gate; record a stated rule = global CLAUDE.md line ~363 of 480 + orient's last block; dispatch a fix for every process failure = global CLAUDE.md deep in the process-failure section, agents: nothing. Compaction: orient runs on every SessionStart source (start, resume, clear, compact) so it restates; gate-digest adds on compact. Subagents: only their definition (bottom) and the SubagentStart gate guide (shell forms only). Pushed down by: the IDENTITY & PROCESS block was printed LAST after ~300 listing lines; definitions carried the rules at the bottom. BUILT: hooks/lib/rule-block.mjs (12 one-line rules, tooling and process, no size filter) printed first by orient.mjs and orient-unbounded.mjs, prepended to the SubagentStart context (subagent-gate-guide.mjs, reaches every agent including general-purpose), copied verbatim as the first body section of all 15 agents/*.md; orient trims listings first (block is not demotable); t decide prints the step that adds a stated rule to the block; contract and commands/decide.md name it. Preload after: 19798 tokens. Check: hooks/rule-block.test.mjs 27 passed (block first in orient, unbounded orient, SubagentStart hand, every agent definition verbatim, block survives the budget trim, size cap). Also passed: orient-trail 5, agent-gate-guide 15, agent-timeout-rule 115, gate-wiring 17, search-adoption 9, contract-rules 48, t-decide 14, t-edit-verbs 13, context-budget 17, stat-cache 8. Pre-existing failure, not mine: hooks/orient.test.mjs 'within the token budget' is 4210 of 4200 chars with the block excluded (it was 4211 before any of my edits).

## History
- [2026-11-21 13:38] (created) bug — process failure + kit bug (road-generator main thread, 2026-11-21): the context preload does not carry tooling rules and big process rules p
- [2026-11-21 13:50] (comment) criterion added: fixed top block of tooling and process rules is first in orient (bounded and unbounded), in the SubagentStart hand and in every agent definition, with a check (rule-block.test.mjs 27 passed)
- [2026-11-21 13:50] (comment) criterion added: preload stays under the 25k ceiling by trimming listings (19798 of 25000), and t decide prints the add-to-block step
- [2026-11-21 13:51] (comment) ticked: fixed top block of tooling and process rules is first in orient (bounded and unbounded), in the SubagentStart hand and in every agent definition, with a check (rule-block.test.mjs 27 passed)
- [2026-11-21 13:51] (comment) ticked: preload stays under the 25k ceiling by trimming listings (19798 of 25000), and t decide prints the add-to-block step
- [2026-11-21 13:51] (status) todo → review
