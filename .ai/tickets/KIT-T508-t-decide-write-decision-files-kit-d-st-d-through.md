---
id: KIT-T508
title: t decide: write decision files (KIT-D###/ST-D###) through one kit command with id allocation, frontmatter, verbatim quotes and the commit, so a decision is never a hand Write. Auto mode's classifier skipped Write on .ai/decisions twice from stiletto-2349-2a (2026-10-14/15, KIT-D095/D096) and refused a SESSION.md line as instruction poisoning; decisions are rules for future agents by nature, so the classifier distrusts them. One command gives Chris a single narrow permission rule to allow
type: feature
status: superseded
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-15T15:01:23Z
updated: 2026-10-15T15:07:51Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T507
### comment #1 [2026-10-15 15:05] @claude
Chris ruled 2026-10-15 (questionnaire): build t decide; he allows that one command once in his settings. Interim: when a decision record is due, the session asks him to switch auto mode off for that one write so he gets a normal approve prompt. Finding: ~/.claude/settings.json already allows Edit(//d/dev/**/.ai/**) and Edit(//d/dev/claude-kit-data/**), yet auto mode's classifier skipped both Writes to .ai/decisions, so a path allow rule does not get past it; the rule must name the command (e.g. Bash(node *t.mjs decide *)).
### comment #2 [2026-10-15 15:07] @claude
Duplicate: t decide already exists (KIT-T481, d8e6d57, 2026-10-14). Filed by 2a without searching the kit for 'decide'; the runtime 2a ran earlier printed a t usage line without decide. Process failure noted on KIT-T507. The open part of Chris's ruling is only his one allow rule for the command.

## History
- [2026-10-15 15:01] (created) feature — t decide: write decision files (KIT-D###/ST-D###) through one kit command with id allocation, frontmatter, verbatim quotes and the commit, so a decision is never a hand Write. Auto mode's classifier skipped Write on .ai/decisions twice from stiletto-2349-2a (2026-10-14/15, KIT-D095/D096) and refused a SESSION.md line as instruction poisoning; decisions are rules for future agents by nature, so the classifier distrusts them. One command gives Chris a single narrow permission rule to allow
- [2026-10-15 15:05] (comment) @claude: Chris ruled 2026-10-15 (questionnaire): build t decide; he allows that one command once in his settings. Interim: when a (full comment #1 in ## Notes)
- [2026-10-15 15:07] (comment) @claude: Duplicate: t decide already exists (KIT-T481, d8e6d57, 2026-10-14). Filed by 2a without searching the kit for 'decide';  (full comment #2 in ## Notes)
- [2026-10-15 15:07] (status) todo → superseded
