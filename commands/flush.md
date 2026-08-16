---
description: Snapshot working state to disk before compact/clear/end-of-session
---
Flush state to disk now, before any compaction or context loss:
1. Update `.ai/SESSION.md` — current state, the next 3 steps, and exact
   commands/errors/paths/version-pins verbatim. Keep it to one screen; overwrite
   stale content. Make the "next 3 steps" point to the right resume point.
2. Update the active ticket's checkboxes and Notes.
3. Append any new settled choices to `.ai/DECISIONS.md`.
4. Confirm what was written in one line. Do not paraphrase exact strings.

If the workflow data is CENTRALIZED (`.ai` is a mount into the shared `claude-kit-data`
repo), never `git add -A` / `git add .` there — `-A` is tree-wide regardless of cwd and
sweeps every other project's subtree, publishing another live session's in-flight edits
under this project's label (KIT-T230). Add and commit by explicit pathspec:
`git -C <data-repo> add -- projects/<name>` then
`git -C <data-repo> commit -m "<msg>" -- projects/<name>`.
