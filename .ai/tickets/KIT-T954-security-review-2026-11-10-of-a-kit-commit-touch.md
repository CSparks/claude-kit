---
id: KIT-T954
title: Security review 2026-11-10 of a kit commit touching hooks/lib/shell-write-scan.mjs (source-shell write gate): (1) a data: URL module loader
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T18:09:27Z
updated: 2026-11-10T18:09:27Z
---

## Description
Security review 2026-11-10 of a kit commit touching hooks/lib/shell-write-scan.mjs (source-shell write gate): (1) a data: URL module loader is scanned as raw text, not decoded the way node decodes it (percent-decode, base64 when ;base64), so an encoded body evades codeHit; dynamic import( or require( inside the decoded body is not treated as a hit. (2) loaded modules are not resolved as node resolves them (file: URLs via fileURLToPath, require extension and index resolution); an unreadable path under tmpdir does not fail closed; nodeLoadedModules breaks instead of failing closed on an unknown option that may take a value. (3) redirectTargets misses output operators (>|, >&word, &>, &>>, N>) and has a [-=] lookbehind; trusted kit/git segments should fail closed on any unquoted > whose target cannot be parsed. Each needs a test that the evasion is caught plus a negative control that a plain read-only command still passes.

kit-bug-shape: cap:bug:security-review-2026-11-10-of-a-kit-commit-touch
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-10 18:09] (created) bug — Security review 2026-11-10 of a kit commit touching hooks/lib/shell-write-scan.mjs (source-shell write gate): (1) a data: URL module loader
- [2026-11-10 18:13] (comment) @kit-agent: Not started by the standing kit agent adcd3ffd (session 5b63523a): the live kit agent a854ac187f0f9c2da (session da28715 (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:13] @kit-agent
Not started by the standing kit agent adcd3ffd (session 5b63523a): the live kit agent a854ac187f0f9c2da (session da28715f, from groovegrid) has hooks/lib/node-args.mjs, hooks/node-args.test.mjs and hooks/shell-write-scan.test.mjs uncommitted and landed KIT-T939 (c14d0f8..d27dc42) in the same module. Two writers in one file lose work (KIT-D155): this ticket stays with that agent, or goes to a fresh dispatch after it commits.
