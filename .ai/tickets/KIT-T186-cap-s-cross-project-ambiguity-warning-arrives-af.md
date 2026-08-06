---
id: KIT-T186
title: cap's cross-project ambiguity warning arrives AFTER the success receipt, and the no-store error names no projects
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:02:33Z
updated: 2026-08-06T02:18:58Z
---

## Description
Two loudness defects on cap's routing, both hit on 2026-08-06 while capturing a kit-shaped
observation from another project's session:

1. A capture whose text obviously names ANOTHER registered project was written to the cwd
   project and the warning was printed AFTER the `captured -> …` receipt. The one line an
   agent relays already read as success, so the mismatch was noticed only later.
2. Run outside every adopted repo, cap said "no .ai/ found above <cwd> — pass --project <name>"
   without naming a single project, so retrying meant going to read the registry. (The
   `--project` mismatch path already listed the known projects; the no-store path did not.)

Deliberately NOT changed: routing itself. KIT-T067 chose propose-don't-route on purpose (cwd
owns the write, another project is only PROPOSED). Whether ambiguity should become a hard
refusal reverses that decision, so it is asked in KIT-Q001 rather than assumed here.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the cross-project warning is emitted BEFORE the write and names the exact --project re-run
- [x] the receipt itself carries [also names <project>] for both inbox and --done captures
- [x] routing is unchanged: the capture still lands in the cwd project, the named one is untouched
- [x] outside every adopted repo cap exits non-zero, says the cwd is not adopted, and lists registered projects with id keys
- [x] scripts/cap.test.mjs asserts the real emission ORDER (stdout+stderr on one fd)
- [x] refuse-vs-warn is asked as KIT-Q001 instead of assumed

## Plan
1. Emit the ambiguity warning before the write, with the exact `cap --project <alias>` re-run.
2. Put an `[also names <project>]` marker in the receipt itself (both the inbox and --done
   receipts), so the relayed line carries the dispute.
3. No-store error: state plainly that the cwd is not an adopted repo and list the registered
   projects with their id keys.
4. Regression tests in scripts/cap.test.mjs, including a real ORDERING assertion (stdout and
   stderr share one fd, so the file records the true emission order).
5. Ask KIT-Q001 about refuse-vs-warn.

## History
- [2026-08-06 02:02] (created) bug — cap's cross-project ambiguity warning arrives AFTER the success receipt, and the no-store error names no projects
- [2026-08-06 02:18] (comment) criterion added: the cross-project warning is emitted BEFORE the write and names the exact --project re-run
- [2026-08-06 02:18] (comment) criterion added: the receipt itself carries [also names <project>] for both inbox and --done captures
- [2026-08-06 02:18] (comment) criterion added: routing is unchanged: the capture still lands in the cwd project, the named one is untouched
- [2026-08-06 02:18] (comment) criterion added: outside every adopted repo cap exits non-zero, says the cwd is not adopted, and lists registered projects with id keys
- [2026-08-06 02:18] (comment) criterion added: scripts/cap.test.mjs asserts the real emission ORDER (stdout+stderr on one fd)
- [2026-08-06 02:18] (comment) criterion added: refuse-vs-warn is asked as KIT-Q001 instead of assumed
- [2026-08-06 02:18] (comment) ticked: the cross-project warning is emitted BEFORE the write and names the exact --project re-run
- [2026-08-06 02:18] (comment) ticked: the receipt itself carries [also names <project>] for both inbox and --done captures
- [2026-08-06 02:18] (comment) ticked: routing is unchanged: the capture still lands in the cwd project, the named one is untouched
- [2026-08-06 02:18] (comment) ticked: outside every adopted repo cap exits non-zero, says the cwd is not adopted, and lists registered projects with id keys
- [2026-08-06 02:18] (comment) ticked: scripts/cap.test.mjs asserts the real emission ORDER (stdout+stderr on one fd)
- [2026-08-06 02:18] (comment) ticked: refuse-vs-warn is asked as KIT-Q001 instead of assumed
- [2026-08-06 02:18] (status) todo → review
- [2026-08-06 02:18] (comment) fixed: warning moved pre-write + receipt marker + no-store error lists projects. Evidence: scripts/cap.test.mjs 25 passed, 0 failed (9 new, incl. the ordering assertion); cli-help 16 passed.
