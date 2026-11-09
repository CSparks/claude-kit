---
id: KIT-T871
title: query-gate: block EVERY grep/rg in Bash incl. single-file and pipes (| grep), naming q code/q show/Read; plus an end-around detector: after
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes: KIT-T919
superseded_by: 
created: 2026-11-06T21:29:00Z
updated: 2026-11-09T23:15:00Z
---

## Description
query-gate: block EVERY grep/rg in Bash incl. single-file and pipes (| grep), naming q code/q show/Read; plus an end-around detector: after any gate block, a same-turn follow-up that pursues the same goal another way (block then 'q show | grep') is refused with 'the block stands'. Evidence 2026-11-06 stiletto-2349: store grep blocked, then 'q show | grep -c' run next; single-file greps on grade.rs/Cargo.toml were never blocked. Chris: 'You CONSISTENTLY end-around even though you get that block'; agent promises do not survive /clear, so enforcement must be a hook.

kit-bug-shape: cap:feature:query-gate-block-every-grep-rg-in-bash-incl-sing
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-06 21:29] (created) feature — query-gate: block EVERY grep/rg in Bash incl. single-file and pipes (| grep), naming q code/q show/Read; plus an end-around detector: after
- [2026-11-09 23:14] (status) todo → superseded (by KIT-T919)
- [2026-11-09 23:14] (unlink) superseded_by KIT-T919; status superseded → todo
- [2026-11-09 23:15] (status) todo → review
- [2026-11-09 23:49] (comment) @kit-agent: Built (5d08f44): store item searches, globs and item reads piped into a search block, naming q show/q inbox/Read. Remain (full comment #1 in ## Notes)
### comment #1 [2026-11-09 23:49] @kit-agent
Built (5d08f44): store item searches, globs and item reads piped into a search block, naming q show/q inbox/Read. Remaining: block pipe and single-file grep outside the item store (KIT-D134 full scope) and the same-turn end-around detector. KIT-T919 closed as its duplicate.
