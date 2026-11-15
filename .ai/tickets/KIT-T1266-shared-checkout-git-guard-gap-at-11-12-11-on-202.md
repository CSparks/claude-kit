---
id: KIT-T1266
title: shared-checkout git guard gap: at 11:12:11 on 2026-11-15 a git pull or rebase with autostash, run by one agent in the road-generator framewo
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes: KIT-T1270
superseded_by:
created: 2026-11-15T17:33:30Z
updated: 2026-11-15T18:03:44Z
---

## Description
shared-checkout git guard gap: at 11:12:11 on 2026-11-15 a git pull or rebase with autostash, run by one agent in the road-generator framework checkout (rapid-game) right after commit 9d26fb36, swept EVERY live writer's uncommitted tracked edits (24 files of five agents) into an autostash entry and never popped it; the agents went on working on a tree missing their own edits for about an hour. The source-shell gate's delete rule says a git stash passes only while no other writer is live, but an autostash through pull or rebase (the --autostash flag, or rebase.autoStash and pull.rebase config, or merge.autoStash) was not refused. Wanted: refuse git pull and git rebase and git merge with --autostash, and any pull or rebase at all while the checkout has uncommitted changes of ANOTHER live writer (the claims know), naming the fix: commit by explicit path, then git fetch and git push; if the push is rejected, raise it to the coordinator. Also check the repo and global git config for autoStash settings and report them. Find from the gate decision log which agent ran it and with what command.

kit-bug-shape: cap:bug:shared-checkout-git-guard-gap-at-11-12-11-on-202:75fbb536
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
FOUND, runtime 743611f carries the fix (guard commit 07eb790, wording 743611f). Who and what: the houses agent a70f54bf (RDG-T081), in one Bash call issued 11:04 local that began executing about 11:11:37: commit of two files by explicit path, then git pull --rebase --autostash origin main, then git push origin HEAD:main, all with output into target/houses/g204.txt. That file shows: commit 9d26fb36; Created autostash: 4a49819e; error: cannot rebase: You have unstaged changes; Applying autostash resulted in conflicts; Your changes are safe in the stash. The stash was not popped because the rebase aborted and the apply conflicted with edits writers made after the stash emptied the tree; git leaves the entry and exits 0. The coordinator found the agent ran the same pull after every commit today (earlier runs stashed and re-applied each time). The entry is stash@{0} autostash, created 11:12:11, kept in the checkout. Config: the config listing for autostash, pull.rebase and rebase in the rapid-game checkout (with origins) shows only file:C:/Program Files/Git/etc/gitconfig pull.rebase false, the Git for Windows system default; no autostash key in repo, global or system config, so the explicit flag did it. Why the gate allowed it: git pull and git rebase were not judged at all and a stash without -u was declared harmless. FIXED: pull and rebase are sweeps (refused while another writer is live in the checkout, whatever the flags or config); the autostash flag on pull, rebase or merge is refused even with no other writer live; git stash push, save and bare are judged (list, show, pop, apply, drop and the other read or restore actions pass); the refusal says: commit by explicit path, git fetch, git push origin HEAD:main; if the push is rejected because the remote moved, git pull --rebase is allowed only when no other writer has uncommitted changes in the checkout, otherwise raise it to the coordinator, who arranges a quiet moment. Tests: hooks/git-integration-guard.test.mjs (the incident command, flags, config-driven plain pulls, rebase, stash, autostash with no other writer, passes: fetch, push, plain merge, stash list show pop apply drop, a pull alone), mutation-checked four ways; source-shell-gate-discard 266 passed 0 failed; source-shell-gate-git-gaps 133 passed 0 failed (its rebase premises updated, and its environment message check follows the KIT-T1262 wording); wrapped 238, delete 63, chained 13, escapes 11, commit-gate-git-call 29, git-call-environment all pass. Note: the agent tool-call row timestamps lag the execution (issued 11:04, ran 11:11).
Round 2, runtime 9cd56ee (two review findings, both tightenings). (1) A merge is now judged like pull and rebase (a sweep while another writer is live; the autostash flag stays an outright refusal), so a merge.autoStash set in config cannot stash behind it; a git config call that SETS merge.autoStash, rebase.autoStash or pull.rebase (also git config set, any scope, case-insensitive key, replace-all and add) is a sweep too; reading, unsetting or listing a key passes. (2) The stash read-or-restore test is one function shared by the judge and the blind reader, and it looks at the FIRST raw token after stash: only list, show, pop, apply, drop, clear, branch, create, store, export-type actions as first token pass; an option first (git stash -m x, --keep-index, -k, -p, -q show, -m list) is a push, and bare words after an option make it wide; git stash -- a.rs is judged per file. Tests: hooks/git-integration-guard.test.mjs extended (config-driven merge, config sets, option-first stashes, the same on an ambiguous-quoting line, passes: stash list, show -p, pop --index, config reads, a merge or config set with no other writer live), mutation-checked (merge judge, config judge, first-token test). The source-shell-gate-discard suite was split into four files by another writer (8562a53): discard 41, discard-live 70, discard-sweeps 75, discard-sweeps-live 80 = 266 passed, 0 failed; source-shell-gate-git-gaps 133 passed, 0 failed; git-integration-guard all pass.

## History
- [2026-11-15 17:33] (created) bug — shared-checkout git guard gap: at 11:12:11 on 2026-11-15 a git pull or rebase with autostash, run by one agent in the road-generator framewo
- [2026-11-15 18:03] (landed) 743611f The refusal of a pull, rebase or stash says when a pull --rebase is allowed (no other writer has uncommitted changes her
- [2026-11-15 18:03] (status) todo → review
- [2026-11-15 18:24] (landed) 9cd56ee A merge is a sweep like a pull and a rebase, a git config call that sets merge.autoStash, rebase.autoStash or pull.rebas
