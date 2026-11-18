---
id: KIT-T1369
title: q gap: 'code' has no --multiline flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T06:25:06Z
updated: 2026-11-18T06:38:53Z
fixed_commit: 5c45ba7d
---

## Description
q code let (mut )?(\w+)(: [^=]+)? = [^;]*\.collect(::<[^;]*>)?\(\);\n\s*(for [^\n]* in &?\2 \{|\2\.(iter|len|is_empty)\(\)) --regex --multiline --path rapid-game/rust/engine --lang rust -C 1 --limit 0

kit-bug-shape: q-gap:flag:code:--multiline
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --multiline (-U) matches a regex across lines: . matches a newline, ^ and $ per line, a match over 50 lines dropped, hits shown as path:start-end, with --lang --path --kind -i -w -C -o -l -c; documented in q --help (scripts/q-multiline.test.mjs)

## Plan
1.

## Notes
Brief (coordinator, 2026-11-18): add `--multiline` to q code: a regex with `.` matching newlines, `^`/`$` per line, a bounded match span, results shown with line ranges, with the usual filters (--lang --path --kind -i -w -C), a test, docs in q --help, then publish. A sweep agent could not search for "collect then iterate once" (a `.collect::<Vec<_>>()` whose binding is only iterated on the next lines). Work in the claude-kit checkout only.

Built: scripts/q-multiline.mjs (regex with flags gms, i for -i, \b..\b for -w; spans mapped to lines; a match spanning over 50 lines dropped; rows `path:12-14` on the first line, `path:13` on the rest, `path-11` on context lines, -o prints the match on one row with newlines shown as ⏎). scripts/code-index-query.mjs parses `--multiline` and `-U` (implies --regex) and uses it in the indexed search; the trigram prefilter still narrows candidates. Help: scripts/q-help.mjs and the q code usage line. Not covered: the on-demand --dir scan of unindexed trees and --registry still match line by line.

Tests: scripts/q-multiline.test.mjs 4 pass (the ticket's collect-then-iterate pattern finds src/once.rs:2-3 and not a binding that is returned; span bound; ^ per line; -i; -w; -C; -c; -l; -o; --path; --lang); scripts/code-index.test.mjs 30 passed. Live check on the kit: `q code "export function multilineSpans.*\n.*lineStarts" --multiline --path scripts` answers scripts/q-multiline.mjs:39-40.

## History
- [2026-11-18 06:25] (created) bug — q gap: 'code' has no --multiline flag
- [2026-11-18 06:38] (status) todo → doing
- [2026-11-18 06:38] (comment) criterion added: q code --multiline (-U) matches a regex across lines: . matches a newline, ^ and $ per line, a match over 50 lines dropped, hits shown as path:start-end, with --lang --path --kind -i -w -C -o -l -c; documented in q --help (scripts/q-multiline.test.mjs)
- [2026-11-18 06:38] (comment) ticked: q code --multiline (-U) matches a regex across lines: . matches a newline, ^ and $ per line, a match over 50 lines dropped, hits shown as path:start-end, with --lang --path --kind -i -w -C -o -l -c; documented in q --help (scripts/q-multiline.test.mjs)
- [2026-11-18 06:38] (status) doing → review
- [2026-11-18 06:38] (comment) runtime 5c45ba7d published
