---
id: KIT-T1373
title: source-shell-write gate false positive: a read-only 'git -C rapid-game log --oneline -1' in the same Bash command as a path containing 'AppD
type: bug
status: doing
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T14:42:24Z
updated: 2026-11-18T15:04:01Z
---

## Description
source-shell-write gate false positive: a read-only 'git -C rapid-game log --oneline -1' in the same Bash command as a path containing 'AppData/Local' was refused as 'the environment is named in the same command (Local)'. The word Local inside a file path is not an environment variable, and git log takes no files. Fix: match env reads as $NAME / %NAME% / env assignments only, and allow-list read-only git verbs (log, show, status, diff).

kit-bug-shape: cap:bug:source-shell-write-gate-false-positive-a-read-on:6b841754
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] a path component spelling local, declare, typeset, export, setenv or environment (AppData/Local/Temp) is no environment change; a real declaration or export, and a leading-backslash escape, still refuse (hooks/source-shell-gate-git-gaps.test.mjs, hooks/git-call-environment.test.mjs)

## Plan
1.

## Notes
Root cause: hooks/lib/git-call-policy.mjs looks for a `local` / `declare` / `typeset` declaration after a wrapper word (env, time, bash, xargs...). In the refused command, `builds --run "env RDG_SEED=... probe.exe" --out "C:/Users/CHRISS~1/AppData/Local/Temp/city13.txt"; ...; git -C rapid-game log --oneline -1`, the wrapper `env` was followed in the same segment by the path component `Local` of the --out path, matched case-insensitively as a `local` declaration before a git word. Path components were blanked only for the word Environment, not for the declaration and export words.

Fix: before every detector runs, the components of path tokens are blanked for environment, local, declare, typeset, export and setenv. A path token has a slash, or a backslash after a first name (`docs\x.md`, `C:\Users`); a backslash that opens the word is a shell escape (`\export`) and stays judged. Read-only git verbs are NOT allow-listed past an environment change: an exported pager, diff driver or GIT_* variable runs programs even under `git log` (the same reason KIT-T1367 kept), so the fix is the false positive, not the rule.

Tests: source-shell-gate-git-gaps 144 passed (new: the incident command passes, the same with backslashes passes, a real `local GIT_DIR` and an export whose value is such a path still refuse); git-call-environment all pass (its `\export` and `docs\environment.md` cases guard the path rule); source-shell-gate 168.

## History
- [2026-11-18 14:42] (created) bug — source-shell-write gate false positive: a read-only 'git -C rapid-game log --oneline -1' in the same Bash command as a path containing 'AppD
- [2026-11-18 15:04] (status) todo → doing
- [2026-11-18 15:04] (comment) criterion added: a path component spelling local, declare, typeset, export, setenv or environment (AppData/Local/Temp) is no environment change; a real declaration or export, and a leading-backslash escape, still refuse (hooks/source-shell-gate-git-gaps.test.mjs, hooks/git-call-environment.test.mjs)
- [2026-11-18 15:04] (comment) ticked: a path component spelling local, declare, typeset, export, setenv or environment (AppData/Local/Temp) is no environment change; a real declaration or export, and a leading-backslash escape, still refuse (hooks/source-shell-gate-git-gaps.test.mjs, hooks/git-call-environment.test.mjs)
