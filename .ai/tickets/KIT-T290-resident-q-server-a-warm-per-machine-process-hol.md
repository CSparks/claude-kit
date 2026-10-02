---
id: KIT-T290
title: Resident q server: a warm per-machine process holds the SQLite index open, keeps it fresh with a file watcher (repo + framework submodule), and answers q code/sym/file over a local socket/named pipe; the CLI uses it when up and falls back to in-process (KIT-T289 git path) when not. Also verify trigram hits from content stored in the DB instead of re-reading files. Target: warm query under ripgrep (~70-80 ms on stiletto) with identical results. Follows KIT-T289 (warm 233-429 ms after the git change signal; floor = node start + module load + git status + hit verification)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-02T16:47:53Z
updated: 2026-10-02T17:27:50Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] No server running -> the q CLI starts one detached (Chris 2026-10-02); in-process fallback answers only while it comes up or if it cannot start. Test: cold call leaves a server up, next call is served by it

## Plan
1.

## History
- [2026-10-02 16:47] (created) feature — Resident q server: a warm per-machine process holds the SQLite index open, keeps it fresh with a file watcher (repo + framework submodule), and answers q code/sym/file over a local socket/named pipe; the CLI uses it when up and falls back to in-process (KIT-T289 git path) when not. Also verify trigram hits from content stored in the DB instead of re-reading files. Target: warm query under ripgrep (~70-80 ms on stiletto) with identical results. Follows KIT-T289 (warm 233-429 ms after the git change signal; floor = node start + module load + git status + hit verification)
- [2026-10-02 16:49] (comment) criterion added: No server running -> the q CLI starts one detached (Chris 2026-10-02); in-process fallback answers only while it comes up or if it cannot start. Test: cold call leaves a server up, next call is served by it
- [2026-10-02 17:17] (comment) @chris: q-server child spawns lacked windowsHide -> flashing console windows stole focus 2026-10-02; fixed by scripts/code-index (full comment #1 in ## Notes)
### comment #1 [2026-10-02 17:17] @chris
q-server child spawns lacked windowsHide -> flashing console windows stole focus 2026-10-02; fixed by scripts/code-index-source.mjs, hooks/lib/exec.mjs, hooks/lib/git-state.mjs, scripts/t.mjs, test scripts/q-server-windowshide.test.mjs (8 calls over 43 modules)
- [2026-10-02 17:25] (comment) @chris: 2026-10-02 incident: the detached server's git child spawns had no windowsHide, so each query burst flashed console wind (full comment #2 in ## Notes)
### comment #2 [2026-10-02 17:25] @chris
2026-10-02 incident: the detached server's git child spawns had no windowsHide, so each query burst flashed console windows that stole focus and blocked mouse input until reboot; every child spawn on the server import graph now passes windowsHide:true, guarded by scripts/q-server-windowshide.test.mjs (mutation-checked)
- [2026-10-02 17:25] (comment) ticked: No server running -> the q CLI starts one detached (Chris 2026-10-02); in-process fallback answers only while it comes up or if it cannot start. Test: cold call leaves a server up, next call is served by it
- [2026-10-02 17:27] (status) todo → review
- [2026-10-02 17:27] (comment) @chris: (fixed) e65ec23; q-server 8 passed, code-index 14 passed, windowshide 1 passed; npm test runner 72/75 ok, 3 unrelated (a (full comment #3 in ## Notes)

## Notes
Evidence 2026-10-02: scripts/q-server.test.mjs 8 passed, 0 failed (cold call leaves a server up, next call served by it; edit-then-search never stale; CLAUDE_KIT_Q_SERVER=off never uses one); scripts/code-index.test.mjs 14 passed; scripts/q-server-windowshide.test.mjs 1 passed (43 modules, 8 calls; mutation-checked in code-index-source.mjs and hooks/lib/exec.mjs). q code/sym/file output byte-identical across cold, warm-server and CLAUDE_KIT_Q_SERVER=off; warm call ~200 ms wall. Full runner: 72 of 75 commands OK; failures not from this change: agent-pins (untracked agents/implementer.md not in plugin.json), server.test (express not installed), doc-review (load flake, passes alone).
### comment #3 [2026-10-02 17:27] @chris
(fixed) e65ec23; q-server 8 passed, code-index 14 passed, windowshide 1 passed; npm test runner 72/75 ok, 3 unrelated (agent-pins: untracked agents/implementer.md, server.test: express missing, doc-review: load flake)
