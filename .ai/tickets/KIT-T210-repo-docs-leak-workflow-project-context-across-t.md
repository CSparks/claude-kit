---
id: KIT-T210
title: Repo docs leak workflow/project context across the board - standalone-docs rule needs doctrine + enforcement + audit
type: bug
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T17:10:42Z
updated: 2026-08-06T17:10:42Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] doctrine: repo artifacts outside kit ceremony (docs/**, source comments, READMEs) carry NO workflow self-reference - no .ai ids, no maintainer identity, no cross-project names, no conversation/session references; ceremony surfaces (commit messages, .ai stores) are the exception
- [ ] enforcement: gate hook flags <KEY>-[TDQN]### ids, known project names, and maintainer identity in non-ceremony files (extends KIT-D059 from comments to all shipped artifacts)
- [ ] audit: sweep active repos' docs/** + source comments for violations; per-repo fix tickets filed

## Plan
1.

## History
- [2026-08-06 17:10] (created) bug — Repo docs leak workflow/project context across the board - standalone-docs rule needs doctrine + enforcement + audit
- [2026-08-06 17:11] (comment) criterion added: doctrine: repo artifacts outside kit ceremony (docs/**, source comments, READMEs) carry NO workflow self-reference - no .ai ids, no maintainer identity, no cross-project names, no conversation/session references; ceremony surfaces (commit messages, .ai stores) are the exception
- [2026-08-06 17:11] (comment) criterion added: enforcement: gate hook flags <KEY>-[TDQN]### ids, known project names, and maintainer identity in non-ceremony files (extends KIT-D059 from comments to all shipped artifacts)
- [2026-08-06 17:11] (comment) criterion added: audit: sweep active repos' docs/** + source comments for violations; per-repo fix tickets filed
- [2026-08-06 17:11] (comment) @claude: Chris (stiletto session 2026-08-06): 'That document needs to be written as if no one knows anything about those other pr (full comment #1 in ## Notes)
### comment #1 [2026-08-06 17:11] @claude
Chris (stiletto session 2026-08-06): 'That document needs to be written as if no one knows anything about those other projects or who I am' -> 'Anything that goes in a document folder outside of the claude kit structure needs to be like that' -> 'that's the problem across the board with Claude kit things' -> 'Self-referential bullshit needs to go away if it's not part of the Claude kit ceremony.' KIT-D059 already covers source comments (ST-T138 lamp.rs was its exemplar); this ticket extends the principle to every shipped artifact. Decision capture: inbox 2026-08-06-1710. Triggering fix: rapid-game docs/recipe-manifesto.md rewritten standalone (8429c75).
