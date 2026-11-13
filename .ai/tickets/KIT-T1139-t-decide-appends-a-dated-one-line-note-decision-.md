---
id: KIT-T1139
title: t decide appends a dated one-line note (decision id and title) to the SESSION.md anchor, so the anchor cannot be stale after a decision
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-13T17:19:44Z
updated: 2026-11-13T17:19:44Z
---

## Description
Process failure 2026-11-13 (road-generator orchestrator): recorded a decision with t decide --file and stopped without t session; the Stop flush hook blocked (SESSION.md was not updated this turn but a decisions edit landed). The rule is flush at every decision; the cheap prevention is for t decide itself to append a dated one-line note (decision id and title) to the session anchor the way it already regenerates the views, so the anchor is never stale after a decision. Keep the Stop check as the backstop. KIT-T1051 is the same idea for broker lands, a different writer. Maintainer rule: KIT-D168 (every process failure gets an agent). Filed by the KIT-T1136 agent: the t CLI source was outside the files it had open. kit-feature

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T1051, KIT-T930

## History
- [2026-11-13 17:19] (created) feature — t decide appends a dated one-line note (decision id and title) to the SESSION.md anchor, so the anchor cannot be stale after a decision
