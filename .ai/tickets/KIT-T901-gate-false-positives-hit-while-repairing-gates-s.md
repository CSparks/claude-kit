---
id: KIT-T901
title: gate false positives hit while repairing gates: source-shell-gate read a script import specifier as a write target and missed Windows 8.3 short temp paths; hand-write-detect flagged a git rename chained with sed -n readers; narration blocks were invisible to turn-text readers
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-08T19:31:26Z
updated: 2026-11-08T19:53:17Z
---

## Description
Found 2026-11-08 under KIT-D147 audit of gates: (1) hooks/lib/shell-source-write.mjs treated 'import ... from <source path>' as a write target when a write call's target was a variable, and did not recognise C:/Users/CHRISS~1/... (8.3) as the temp dir; (2) hooks/lib/shell-snapshot.mjs did not treat sed without -i as a reader, so git mv chained with sed -n was flagged a hand write. Fixed with tests (source-shell-gate 136, hand-write-detect 49).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] import specifiers and Windows 8.3 temp paths no longer trip source-shell-gate; git rename chained with sed -n readers no longer trips hand-write-detect (source-shell-gate 136 passed, hand-write-detect 49 passed)

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T733, KIT-T792, KIT-T701, KIT-T893
Also from the KIT-D147 audit: request-gate and land-alert kept a text-only extractor for assistant prose (flush.mjs reads only the maintainer's text and is unaffected), so a receipt or landing acknowledgement written as narration blocks would not be seen; both now use hooks/lib/assistant-text.mjs, the one home shared with turn-text (request-gate 2b narration test, land-alert 0 failed). Audited and unchanged: question-gate stopped at the first bad question (fixed under KIT-T898); query-gate and broker-wait-gate blocks hit today were true violations (a grep, a 600000 ms timeout), not bugs.

## History
- [2026-11-08 19:31] (created) bug — gate false positives hit while repairing gates: source-shell-gate read a script import specifier as a write target and missed Windows 8.3 short temp paths; hand-write-detect flagged a git rename chained with sed -n readers; narration blocks were invisible to turn-text readers
- [2026-11-08 19:31] (comment) criterion added: import specifiers and Windows 8.3 temp paths no longer trip source-shell-gate; git rename chained with sed -n readers no longer trips hand-write-detect (source-shell-gate 136 passed, hand-write-detect 49 passed)
- [2026-11-08 19:31] (comment) ticked: import specifiers and Windows 8.3 temp paths no longer trip source-shell-gate; git rename chained with sed -n readers no longer trips hand-write-detect (source-shell-gate 136 passed, hand-write-detect 49 passed)
- [2026-11-08 19:34] (landed) 9abce45 gates read their input correctly: source-shell-gate ignores import specifiers and 8.3 temp paths, hand-write-detect trea
- [2026-11-08 19:53] (status) todo → review
