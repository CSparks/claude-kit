---
id: KIT-T481
title: Kit decision files cannot be written under auto mode: the classifier refuses Write/Edit to .ai/decisions; the kit needs a sanctioned CLI path (t decide --file)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T18:27:17Z
updated: 2026-10-14T18:32:04Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] t decide --file <draft.md> validates the draft (title, Decision/Why, date), claims the draft id exactly or the next one, writes .ai/decisions/<id>-<slug>.md with the body verbatim; refusals mint no id (scripts/t-decide.test.mjs 4 passed)

## Plan
1.

## History
- [2026-10-14 18:27] (created) bug — Kit decision files cannot be written under auto mode: the classifier refuses Write/Edit to .ai/decisions; the kit needs a sanctioned CLI path (t decide --file)
- [2026-10-14 18:31] (comment) criterion added: t decide --file <draft.md> validates the draft (title, Decision/Why, date), claims the draft id exactly or the next one, writes .ai/decisions/<id>-<slug>.md with the body verbatim; refusals mint no id (scripts/t-decide.test.mjs 4 passed)
- [2026-10-14 18:32] (comment) ticked: t decide --file <draft.md> validates the draft (title, Decision/Why, date), claims the draft id exactly or the next one, writes .ai/decisions/<id>-<slug>.md with the body verbatim; refusals mint no id (scripts/t-decide.test.mjs 4 passed)
- [2026-10-14 18:32] (comment) @claude: Built t decide (scripts/t-decide.mjs). Recorded KIT-D093 (broker pipeline) and KIT-D094 (standing kit agent + unreachabl (full comment #1 in ## Notes)
### comment #1 [2026-10-14 18:32] @claude
Built t decide (scripts/t-decide.mjs). Recorded KIT-D093 (broker pipeline) and KIT-D094 (standing kit agent + unreachable devices) through it from the coordinator's drafts; the bodies are byte-identical to the drafts. Cites in user-config/CLAUDE.global.md, hooks/orient.mjs and scripts/kit-bug.mjs now point at KIT-D094. Evidence: t-decide 4 passed, kit-bug 16 passed.
- [2026-10-14 18:32] (status) todo → review
