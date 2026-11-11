---
id: KIT-T939
title: source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T935
superseded_by:
created: 2026-11-10T16:41:05Z
updated: 2026-11-10T17:33:40Z
---

## Description
source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed ungated; the same shape against scripts/t-decide.mjs one call later was blocked). Found while fixing KIT-T938; process failure on my side (hand-wrote source via shell), gate miss on the first call.

kit-bug-shape: cap:bug:source-shell-gate-missed-a-node-e-one-liner-that
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A node -e one-liner writing a source path that names a kit script (scripts/t.mjs) is blocked on the first call
- [x] A read-only q call whose pattern holds escaped quotes and write words (rm, >, touch() is not blocked; a write behind an operator still is

## Plan
1.

## History
- [2026-11-10 16:41] (created) bug — source-shell-gate missed a node -e one-liner that wrote scripts/t.mjs with fs.writeFileSync (replace + writeFileSync on a source path passed
- [2026-11-10 17:32] (landed) c14d0f8 source-shell-gate: a node -e one-liner naming a kit script path is no kit verb (the exemption reads only the script node
- [2026-11-10 17:33] (comment) criterion added: A node -e one-liner writing a source path that names a kit script (scripts/t.mjs) is blocked on the first call
- [2026-11-10 17:33] (comment) criterion added: A read-only q call whose pattern holds escaped quotes and write words (rm, >, touch() is not blocked; a write behind an operator still is
- [2026-11-10 17:33] (comment) ticked: A node -e one-liner writing a source path that names a kit script (scripts/t.mjs) is blocked on the first call
- [2026-11-10 17:33] (comment) ticked: A read-only q call whose pattern holds escaped quotes and write words (rm, >, touch() is not blocked; a write behind an operator still is
- [2026-11-10 17:33] (comment) @claude: Fixed in c14d0f8. Cause 1: judgeSegment exempted any node segment where ANY word had a kit-script basename, so a scripts (full comment #1 in ## Notes)
### comment #1 [2026-11-10 17:33] @claude
Fixed in c14d0f8. Cause 1: judgeSegment exempted any node segment where ANY word had a kit-script basename, so a scripts/t.mjs path inside node -e code made it a kit verb; now only the first non-flag argument, never under -e/-p. Cause 2: with ambiguous quoting every write token anywhere blocked, including inside a q pattern; now the command is cut on every operator and pieces led by a kit verb are skipped. The hand-write detector (shell-snapshot) shared cause 1 and now uses the same helper. Tests: source-shell-gate 154 passed, hand-write-detect 59, store-shell-gate 40, shell-writes 7; mutation A (old exemption) fails 5, B (no kit-led filter) fails 9, C (over-permissive filter) fails 4 controls.
- [2026-11-10 17:33] (status) todo → review
- [2026-11-10 17:33] (landed) ae0b845 tickets: KIT-T939 in review, KIT-T934 and KIT-T935 superseded by it (implements KIT-T939)
- [2026-11-10 17:38] (landed) 677c417 WIP node option grammar for kit-verb recognition and node inline code detection (implements KIT-T939)
- [2026-11-10 17:40] (landed) 3172aab node option grammar: value options, inline -pe/--eval=, tests (implements KIT-T939)
- [2026-11-10 17:44] (landed) d27dc42 node option grammar: a code-loading option (-r, --require, --import, --loader, --experimental-loader, --env-file, separa
- [2026-11-10 17:48] (comment) @claude: Review hardening, d27dc42: node option grammar in hooks/lib/node-args.mjs. A code-loading option (-r, --require, --impor (full comment #2 in ## Notes)
### comment #2 [2026-11-10 17:48] @claude
Review hardening, d27dc42: node option grammar in hooks/lib/node-args.mjs. A code-loading option (-r, --require, --import, --loader, --experimental-loader, --env-file[-if-exists], separate or =-joined, or a short cluster with r), inline code (-e, -p, -pe, --eval=, --print=), stdin and any unplaced option make a call no kit verb; only -C, --conditions, --input-type, --title, --stack-trace-limit values are skipped; --eval=/-pe now also read as inline code by the write scan. Tests: node-args 76, source-shell-gate 167, store-shell-gate 40, shell-writes 7, hand-write-detect 59; mutations: loaders skipped as value options fails 13, =-joined/blanket experimental- fails 10. Runtime d27dc42 is current; the full-suite follow-up runs in the background.
- [2026-11-10 17:48] (landed) 06c4443 KIT-T939 notes: node option grammar hardening and runtime d27dc42 (implements KIT-T939)
