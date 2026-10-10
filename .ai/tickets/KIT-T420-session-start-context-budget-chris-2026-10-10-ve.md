---
id: KIT-T420
title: Session-start context budget (Chris 2026-10-10, verbatim: 'weekly we need to be looking at what our stand-up context size looks like. We should never be spinning up new sessions with more than 25k of ceremonial context.'). Build scripts/context-budget.mjs: measures every SessionStart injection in tokens (global CLAUDE.md, project CLAUDE.md, orient output, housekeeping, memory index, SESSION.md, hook additionalContext, MCP/skill preambles the kit controls) per registered project; prints a table + total; WARNS over 20k, FAILS over 25k naming the biggest items and what to trim; orient prints its own cost on one line; weekly housekeeping nag runs it. Measured 2026-10-10 dirt-empire: global CLAUDE.md ~5.5k, project CLAUDE.md ~3.1k, orient ~3.9k, SESSION.md ~5.6k (contract says one screen), memory 35 -> ~18k kit-controllable before harness tool schemas --link KIT-T419
type: feature
status: review
priority: critical
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-10T16:14:20Z
updated: 2026-10-10T16:40:43Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-10 16:14] (created) feature — Session-start context budget (Chris 2026-10-10, verbatim: 'weekly we need to be looking at what our stand-up context size looks like. We should never be spinning up new sessions with more than 25k of ceremonial context.'). Build scripts/context-budget.mjs: measures every SessionStart injection in tokens (global CLAUDE.md, project CLAUDE.md, orient output, housekeeping, memory index, SESSION.md, hook additionalContext, MCP/skill preambles the kit controls) per registered project; prints a table + total; WARNS over 20k, FAILS over 25k naming the biggest items and what to trim; orient prints its own cost on one line; weekly housekeeping nag runs it. Measured 2026-10-10 dirt-empire: global CLAUDE.md ~5.5k, project CLAUDE.md ~3.1k, orient ~3.9k, SESSION.md ~5.6k (contract says one screen), memory 35 -> ~18k kit-controllable before harness tool schemas --link KIT-T419
- [2026-10-10 16:14] (comment) @claude: Chris 2026-10-10 (verbatim): 'That's where the documentation tree fills in the gaps.' / 'Also, smaller contexts produce  (full comment #1 in ## Notes)
### comment #1 [2026-10-10 16:14] @claude
Chris 2026-10-10 (verbatim): 'That's where the documentation tree fills in the gaps.' / 'Also, smaller contexts produce better results. Better adherence as well.' -> the ceremonial context is pointers + hard rules only; detail lives in the docs tree and is pulled on demand (q, code-graph, doc-trail, skills). context-budget.mjs should name, for each oversize injection, the docs/ home the content moves to; the decision records the why: smaller context = better results and adherence
- [2026-10-10 16:15] (comment) @claude: Chris 2026-10-10 (verbatim): 'and that process should run automatically with an agent unless the agent sees something th (full comment #2 in ## Notes)
### comment #2 [2026-10-10 16:15] @claude
Chris 2026-10-10 (verbatim): 'and that process should run automatically with an agent unless the agent sees something that needs to be raised to my attention.' -> the weekly run is an AGENT dispatched automatically when due (housekeeping/orient auto-dispatch or a scheduled trigger), not a nag for Chris: it runs the script, applies what is safe (table re-dates, docs moves proposed as a ticket, trims within the ceiling), and raises ONLY exceptions (a proposed model downgrade/upgrade, an injection that cannot be trimmed under 25k) as one AskUserQuestion-ready item
- [2026-10-10 16:33] (status) todo → doing
- [2026-10-10 16:40] (comment) @claude: Landed: scripts/context-budget.mjs (per project table, warn 20k/fail 25k, docs-home advice), orient cost line, weekly ho (full comment #3 in ## Notes)
### comment #3 [2026-10-10 16:40] @claude
Landed: scripts/context-budget.mjs (per project table, warn 20k/fail 25k, docs-home advice), orient cost line, weekly housekeeping agent directive, KIT-D089. Tests: scripts/context-budget.test.mjs 17 passed
- [2026-10-10 16:40] (status) doing → review
