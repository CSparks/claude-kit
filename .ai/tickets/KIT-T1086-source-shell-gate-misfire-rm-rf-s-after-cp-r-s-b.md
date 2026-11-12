---
id: KIT-T1086
title: source-shell-gate misfire: 'rm -rf $S/after && cp -r $S/base $S/after && cp a.mjs b.mjs c.mjs $S/after/hooks/lib/ && (bash ...)' blocked as
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-11T23:39:27Z
updated: 2026-11-12T00:15:48Z
---

## Description
source-shell-gate misfire: 'rm -rf $S/after && cp -r $S/base $S/after && cp a.mjs b.mjs c.mjs $S/after/hooks/lib/ && (bash ...)' blocked as 'writes a source file by hand ($S/base/any.rs)'. A recursive directory copy of a git-archive export into a scratch dir is not a hand write, and the reported path (base/any.rs) is the copy SOURCE, not a target.

kit-bug-shape: cap:bug:source-shell-gate-misfire-rm-rf-s-after-cp-r-s-b
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] the ticket line (rm, cp -r, three repo sources into a scratch directory, a bash child) passes when its scratch variable is assigned in the command and blocks when it is not
- [x] a recursive or several-source copy into the repo, an unresolved variable and every non-allowlisted option stay blocked

## Plan
1.

## Notes
Fix 08da941 (pushed), runtime 08da941 published and probed with 10 real payloads (3 passes incl. the ticket line, 7 blocks). Root cause, three layers. (1) shell-variables.mjs: the T1082 allowlist trusts a command only when EVERY segment is a known-safe command; rm and the trailing child (bash bracketed) were not listed, so the scratch variable stayed unresolved and every operand of the cp -r was judged as a cwd-relative write (the reported base/any.rs is the copy SOURCE listed as a write because cp -r is outside the proven shape). (2) shell-copy-target.mjs: even with the variable resolved, cp of three repo source files into a directory and cp -r were uncertain shapes, so each repo source was a write. (3) PLAIN_VALUE refused a tilde, so an unquoted 8.3 scratchpad path (CHRISS~1) never expanded. Reading of the ticket: the filed text omits the S= assignment; with S assigned earlier in the command it now passes, verbatim without an assignment it still blocks (unresolved stays fail-closed, tested both ways). Changes: SAFE_COMMANDS gains rm, rmdir, remove-item, bash, sh, node; a segment that is one whole subshell (open and close in the same segment, no other parentheses) is judged by its inner command, a half-open, nested or split subshell stays untrusted; PLAIN_VALUE allows an inner tilde and still refuses a leading one. Decision on rm and the brief's path guards (no glob, no .., no root, under scratch or temp): not added here. rm binds no variable, which is the only question this allowlist answers; delete operands reach DELETE_CMD raw and never pass expandVariables, so resolving a variable never makes a delete more permissive (rm of a variable operand ending in a source extension still blocks, tested), and assignedValues has no consumer except the copy judge (q code assignedValues: shell-write-scan.mjs only). A path guard there would be a second delete judge in the wrong layer. bash, sh and node are required by the (bash ...) tail because trust covers the whole command; a child process cannot rebind its parent's variables, and what a child's script writes is judged by the write scan, not here. Side effect: the T1082 case bash -c SP=src (and a function named bash) stays blocked only because writesTo counts two writes to the name; added as tests. shell-copy-target.mjs: cp accepts -r -R --recursive and clusters of the safe letters f p v n r R (mv: f v n); several sources into a directory (last operand or -t DIR) are proven, each source landing at DIR/<name> (new landings field, proven shape also carries recursive); a recursive copy also judges <landing>/any.rs and <landing>/<under>/any.rs, so a destination inside the repo blocks via the destination, never via the sources. shell-write-scan judgeCopy tags each source hit outsideTo its own landing (was: the destination). Still uncertain: -a, --parents, links, -T, clusters holding t or any other letter, globs, trailing-slash pairs, PowerShell comma lists. Flipped existing cases, written justification: shell-copy-target.test 'several sources' (cp x dir/c temp) moved from blocked to allowed because each source now has a proven landing outside the repo and the old block was the one-source grammar, not a rule about the destination; 'the strict grammar refuses -r' became refuses -a. Kept blocked on purpose: cp -r or pair copy into an EXISTING directory named without a slash (landsOutsideRepo's existing-directory rule, unchanged), and a source whose own landing is an existing directory. Same root cause as KIT-T1078 (rm -rf plus cp -r into a scratchpad named by a variable, road-generator): fixed by this commit. Tests on a git archive export of HEAD with the touched files overlaid: shell-variables-allowlist 192 (was 159), shell-rebinder-qualifiers 23, source-shell-gate 168, source-shell-gate-wrapped 238, source-shell-gate-escapes 11, source-shell-gate-delete 19, store-shell-gate 52, shell-write-scan 54, shell-copy-target 76 (was 77: one case moved), shell-copy-target-dir 44 (new), legacy-freeze-gate 104, node-args 76, shell-segments 44, patch-apply 77, all exit 0. Mutation controls on an export (scratchpad t1086-mutate.mjs): 21 mutations, 20 killed; the survivor (whole-subshell regex widened to .* ) is equivalent, since the inner text of a nested subshell still starts with an unlisted paren word. Process notes: two gate blocks hit me from the unpublished bug itself (known bug KIT-T1086, this agent) and one pre-write magic-number block (bare 3, fixed with a named constant). Handoff kit-agent-T1086: Jobs: fix. State: done, nothing open. Next: none. Files: hooks/lib/shell-variables.mjs, hooks/lib/shell-copy-target.mjs, hooks/lib/shell-write-scan.mjs, hooks/shell-variables-allowlist.test.mjs, hooks/shell-copy-target.test.mjs, hooks/shell-copy-target-dir.test.mjs.

## History
- [2026-11-11 23:39] (created) bug — source-shell-gate misfire: 'rm -rf $S/after && cp -r $S/base $S/after && cp a.mjs b.mjs c.mjs $S/after/hooks/lib/ && (bash ...)' blocked as
- [2026-11-12 00:14] (landed) 08da941 source-shell-gate: rm, a bash/sh/node child and a whole subshell keep a scratch variable resolved; cp -r and several sou
- [2026-11-12 00:15] (comment) criterion added: the ticket line (rm, cp -r, three repo sources into a scratch directory, a bash child) passes when its scratch variable is assigned in the command and blocks when it is not
- [2026-11-12 00:15] (comment) criterion added: a recursive or several-source copy into the repo, an unresolved variable and every non-allowlisted option stay blocked
- [2026-11-12 00:15] (comment) ticked: the ticket line (rm, cp -r, three repo sources into a scratch directory, a bash child) passes when its scratch variable is assigned in the command and blocks when it is not
- [2026-11-12 00:15] (comment) ticked: a recursive or several-source copy into the repo, an unresolved variable and every non-allowlisted option stay blocked
- [2026-11-12 00:15] (status) todo → review
