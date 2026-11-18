---
id: KIT-T1367
title: source-shell-write gate misreports read-only git calls beside an export: a Bash command that exported two env vars for a program run and ALS
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T02:32:25Z
updated: 2026-11-18T03:23:21Z
---

## Description
source-shell-write gate misreports read-only git calls beside an export: a Bash command that exported two env vars for a program run and ALSO ran 'git -C rapid-game log -1 --format=%h -- <path>' and 'git status --short -- <path>' was blocked with the headline 'a shell command deletes a source file by hand (rapid-game/*)'. Neither git call can delete or hide files. Expected: read-only git verbs (log, status, diff, show, rev-parse) pass whatever the environment, or the block text names the real reason (git call beside an env change) instead of a delete. Seen by planet agent a44c292860ff07f51 in road-generator, 2026-11-18.

kit-bug-shape: cap:bug:source-shell-write-gate-misreports-read-only-git:ebf45ed4
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] an export or prefix assignment of CARGO_, BEVY_, RUST_ or WGPU_ names set to literal values, beside read-only git calls with a pathspec, passes; a GIT_ name in the same export, a value from a substitution, a second plain export, or a real discard still refuses (hooks/source-shell-gate-git-gaps.test.mjs)
- [x] a refused off-list git call has a headline naming the git call and its reason with the offending token, not a hand delete

## Plan
1.

## Notes
Root cause: hooks/lib/git-call-policy.mjs treats any git call in a command that names the environment (here the token `export`) as off the allow-list: git reads GIT_*, PATH, HOME, pager and editor variables, so an export can redirect even `git log`. hooks/lib/git-discards.mjs turns every off-list call into a sweep hit (path `<dir>/*`, deletes: true), refused while another writer is live, and source-shell-gate.mjs headlined every delete-flagged hit as "a shell command deletes a source file by hand (<dir>/*)".

Fix: (1) names under ALLOWED_ENV_PREFIXES (CARGO_, BEVY_, RUST_, WGPU_: build and engine settings that git and the programs it launches never read) set to literal values are exempt, as prefix assignments and as an export whose every name is allowed (that export is blanked before the environment search). Any other name, a non-literal value or another export keeps the refusal. (2) A sweep hit's headline is "<git call> may take files it does not name (<path>), refused because: <reason naming the token>".

The planet agent's earlier refusal (02:22Z) also carried a git stash of `$F` plus variable reads: still refused, correctly.

KIT-T1360 follow-up, road-generator: it has no ignore file or path rule; .ron is not a source extension, so sed or cp onto world.ron passes the gate by itself. The mountain agent af91048's two refusals (2026-11-18 00:35-00:36Z) were generic: `cp $W ...` and `sed ... > $W` with W assigned in a command that also loops (no assignment is trusted, so the operand is judged as a source write `$W/any.rs`), and `rm -rf "$X"` (a variable delete operand). With literal paths both pass: `cp -r` into target/ and `rm -r target/<dir>` (build output is not judged). The recipe in agents/implementer.md and the source-shell advice now says to spell paths as literals; hooks/agent-recipes.test.mjs proves both forms and the refusal of the variable form.

Tests: source-shell-gate-git-gaps 140 passed; source-shell-gate 168; source-shell-gate-discard 41; discard-sweeps 75; git-call-environment all pass; agent-recipes all pass (10). Plugin 0.1.58 for the implementer text.

## History
- [2026-11-18 02:32] (created) bug — source-shell-write gate misreports read-only git calls beside an export: a Bash command that exported two env vars for a program run and ALS
- [2026-11-18 03:23] (status) todo → doing
- [2026-11-18 03:23] (comment) criterion added: an export or prefix assignment of CARGO_, BEVY_, RUST_ or WGPU_ names set to literal values, beside read-only git calls with a pathspec, passes; a GIT_ name in the same export, a value from a substitution, a second plain export, or a real discard still refuses (hooks/source-shell-gate-git-gaps.test.mjs)
- [2026-11-18 03:23] (comment) criterion added: a refused off-list git call has a headline naming the git call and its reason with the offending token, not a hand delete
- [2026-11-18 03:23] (comment) ticked: an export or prefix assignment of CARGO_, BEVY_, RUST_ or WGPU_ names set to literal values, beside read-only git calls with a pathspec, passes; a GIT_ name in the same export, a value from a substitution, a second plain export, or a real discard still refuses (hooks/source-shell-gate-git-gaps.test.mjs)
- [2026-11-18 03:23] (comment) ticked: a refused off-list git call has a headline naming the git call and its reason with the offending token, not a hand delete
