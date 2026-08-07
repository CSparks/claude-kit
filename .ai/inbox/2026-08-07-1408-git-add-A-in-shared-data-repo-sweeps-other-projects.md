(bug) `git add -A` run from a project's .ai mount stages the ENTIRE shared claude-kit-data
repo (git 2.0+ semantics: -A is tree-wide regardless of cwd). Bit 2026-08-07: gridiron
flush commit 3300263 swallowed stiletto-2349's uncommitted ticket edits (ST-T175/T178/
T179 + views) under a gridiron-labeled message, pushed. Content intact, label wrong,
and a live session's in-flight edits can be published mid-edit. Fix direction: flush
instructions + any committing hook/skill must add by EXPLICIT PATH (or `git add -- .`
from the project subdir / pathspec-limit to `projects/<name>/`) in the shared store;
enforcement candidate: commit-gate warns when a data-repo commit touches >1 project
subtree.
