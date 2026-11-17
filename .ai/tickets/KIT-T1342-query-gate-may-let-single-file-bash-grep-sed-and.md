---
id: KIT-T1342
title: query gate may let single-file Bash grep, sed and cat on framework source through: a read-only analysis agent ran about five such calls (gre
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: [KIT-T871]
files: []
supersedes:
superseded_by:
created: 2026-11-17T14:46:53Z
updated: 2026-11-17T15:07:20Z
---

## Description
query gate may let single-file Bash grep, sed and cat on framework source through: a read-only analysis agent ran about five such calls (grep on a bevy_pbr registry file, sed on repo docs) and no hook stopped them, while tree-wide greps and .ai-store greps are blocked. Unverified: reproduce with a one-file 'grep -n x file.rs' and 'sed -n 1,40p file.rs' in a read-only agent and in the main session, and decide whether the gate should redirect them to q code / Read

kit-bug-shape: cap:bug:query-gate-may-let-single-file-bash-grep-sed-and:d72ac65c
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A Bash pattern search of ONE named non-store file (grep/rg/git grep/sed -n '/x/p'/awk '/x/'/Select-String, cat f | grep) is blocked with the exact q code --dir equivalent; reads, output filters, scratch/outside files, the Grep tool and Read pass

## Plan
1.

## Notes
Reproduced 2026-11-17 against hooks/query-gate.mjs: grep -n, rg, sed -n 1,40p and cat of one in-repo file all exited 0. Gap, not intent: KIT-D134 (accepted, Chris 2026-11-06) says single-file grep is enforced by hook; KIT-T871's last comment lists 'block pipe and single-file grep outside the item store' as unbuilt; the gate header and block messages said 'a targeted grep of one file is allowed' from before D134. No later ruling found (q fts single-file grep / targeted grep). Built: hooks/lib/one-file-search.mjs (check id one-file-search): grep/egrep/fgrep/rg/ag/ack, git grep, sed -n '/x/p' (no -i), awk '/x/', Select-String/sls of concrete files, plus cat/head/tail/type/gc/sed-range of ONE file piped into grep/Select-String. Redirect: q code <pat> [flags] --dir <file> (indexEquivalent file mode: --dir works for any file; flags -i -w -F -E -c -l -A/-B/-C modelled; unmodelled flags such as -v keep pattern and --dir), registry/vendor files name q code --registry <crate>, and every block names the Read tool. Passes: cat/head/tail and bare sed -n A,Bp reads (reading is Read's; KIT-T080 treats a line range as a read, and blocking them would also catch output filtering), sed -i, sed/awk non-search scripts, output filters (cargo test | grep), files in a session scratchpad or outside every adopted repo, .ai config/state files, the Grep tool on ONE file (D134 says Bash; left as the remaining inconsistency), the Read tool. Flipped tests (rewritten to assert the block): query-gate.test.mjs x9, query-gate-pipes.test.mjs x5 (cat|grep, tail|grep, grep|head, PowerShell Select-String, Select-String one file, TS file), query-gate-variables.test.mjs x1, git-search.test.mjs x8. New: hooks/query-gate-one-file.test.mjs (54 checks). Still open under KIT-T871: the same-turn end-around detector. Tests: query-gate x5 files, git-search, index-redirect, block-triage, search-telemetry, search-adoption (7), q (112): all pass.

## History
- [2026-11-17 14:46] (created) bug — query gate may let single-file Bash grep, sed and cat on framework source through: a read-only analysis agent ran about five such calls (gre
- [2026-11-17 15:06] (comment) criterion added: A Bash pattern search of ONE named non-store file (grep/rg/git grep/sed -n '/x/p'/awk '/x/'/Select-String, cat f | grep) is blocked with the exact q code --dir equivalent; reads, output filters, scratch/outside files, the Grep tool and Read pass
- [2026-11-17 15:06] (comment) ticked: A Bash pattern search of ONE named non-store file (grep/rg/git grep/sed -n '/x/p'/awk '/x/'/Select-String, cat f | grep) is blocked with the exact q code --dir equivalent; reads, output filters, scratch/outside files, the Grep tool and Read pass
- [2026-11-17 15:07] (status) todo → review
