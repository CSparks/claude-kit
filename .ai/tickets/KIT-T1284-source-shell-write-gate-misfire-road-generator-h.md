---
id: KIT-T1284
title: source-shell-write gate misfire (road-generator houses agent a70f54bfd9ae58e5d): it blocked a 'builds --run "cargo build -p road-generator -
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-15T22:12:50Z
updated: 2026-11-15T22:42:16Z
---

## Description
source-shell-write gate misfire (road-generator houses agent a70f54bfd9ae58e5d): it blocked a 'builds --run "cargo build -p road-generator --bin probe && cp target/debug/probe.exe target/houses/probe-buildings.exe && SHOT_DIR=... probe-buildings.exe looks ..."' call as 'writes a source file by hand (&&/any.rs)': it parsed the '&&' inside the quoted broker command as a written path. The command copies a built exe and writes no source. Expected: no block for a cp of a non-source file, and '&&' never read as a path.

kit-bug-shape: cap:bug:source-shell-write-gate-misfire-road-generator-h:355c4a8c
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Fixed in 2791d58 (runtime 2791d58). Cause: judgeSegment in hooks/lib/shell-write-scan.mjs tries EVERY word of a segment as a possible write tool (so a wrapper cannot steer a deny gate) and gives it the rest of the segment text as its argument text; the cp inside the quoted command of builds --run therefore took the text after it, the double ampersand and the closing quote included, as operands, and the strict copy allowlist failed closed on them as the double-ampersand path with any.rs. The same happens for bash -c with a quoted cp (checked), which is untouched here. Fix: runner-texts.mjs names builds --run as a runner (its quoted command is the text it runs) and judgeSegment, for a segment led by builds with --run, keeps only the launcher own redirects and scans the quoted command with scanAllShellWrites as a command of its own, so a copy of a built exe under target/ passes exactly as a direct call, and a hand write of a source file inside it is still refused with the file named. Tests: hooks/source-shell-gate-builds-run.test.mjs (the incident command, single-quoted and PowerShell forms, a deps exe copy, a non-source cp; refused: echo into src, cp src to src, tee, sed -i, cp onto src/probe.rs, rm, a redirect of the launcher itself into a source file; other builds verbs unchanged), mutation-checked. Suites with no FAIL: source-shell-gate, wrapped, delete, chained, escapes, copy-variable, touch, vendor, main-thread, git-gaps 133, discard 41, discard-live 71, discard-sweeps 75, shell-copy-target and -dir, hand-write-detect 73. Open, same class and not asked: a quoted cp after bash -c, eval or su -c is still fail-closed on the rest of the line.

## History
- [2026-11-15 22:12] (created) bug — source-shell-write gate misfire (road-generator houses agent a70f54bfd9ae58e5d): it blocked a 'builds --run "cargo build -p road-generator -
- [2026-11-15 22:42] (landed) 2791d58 The quoted command of builds --run is judged as the command it is, not as operands of the launcher (implements KIT-T1284
- [2026-11-15 22:42] (status) todo → review
