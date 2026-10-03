---
id: KIT-T302
title: pre-write gate misses a submodule's .claude-kit-ignore.yaml for a file in a NOT-YET-EXISTING directory: hooks/pre-write.mjs:174 runs gitRoot
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T09:09:22Z
fixed_commit: f86a13a35a349ea6055063dea1d702805c5cf995
updated: 2026-10-03T09:20:25Z
---

## Description
pre-write gate misses a submodule's .claude-kit-ignore.yaml for a file in a NOT-YET-EXISTING directory: hooks/pre-write.mjs:174 runs gitRoot(dirname(file)), git rev-parse fails because the cwd does not exist, so ROOT falls back to projectRoot (nearest Cargo.toml = the crate dir) and the repo-root ex

kit-bug-shape: cap:bug:pre-write-gate-misses-a-submodule-s-claude-kit-i
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A write into a not-yet-existing folder reads the repo-root .claude-kit-ignore.yaml (git root from the nearest existing ancestor), in pre-write and tree-liveness

## Plan
1.

## History
- [2026-10-03 09:09] (created) bug — pre-write gate misses a submodule's .claude-kit-ignore.yaml for a file in a NOT-YET-EXISTING directory: hooks/pre-write.mjs:174 runs gitRoot
- [2026-10-03 09:20] (comment) criterion added: A write into a not-yet-existing folder reads the repo-root .claude-kit-ignore.yaml (git root from the nearest existing ancestor), in pre-write and tree-liveness
- [2026-10-03 09:20] (comment) ticked: A write into a not-yet-existing folder reads the repo-root .claude-kit-ignore.yaml (git root from the nearest existing ancestor), in pre-write and tree-liveness
- [2026-10-03 09:20] (status) todo → review
- [2026-10-03 09:20] (comment) @sonnet55: (fixed) f86a13a35a349ea6055063dea1d702805c5cf995

## Notes
Fix f86a13a35a349ea6055063dea1d702805c5cf995: gitRootOfFile in hooks/lib/paths.mjs (nearest existing ancestor), used by pre-write.mjs and tree-liveness.mjs (its repoId now takes targetRoot). Other gitRoot(dirname(...)) sites: none (lint.mjs/jscpd.mjs use projectRoot/dir, not git). Tests: hooks/exclusions.test.mjs section 10; mutation back to gitRoot(dirname(file)) fails the exclusion case; 37 hook test files pass; broker suite 57 passed. Test fixtures now use realpathSync.native(tmpdir) in exclusions/comment-gate/pre-write tests: git reports the long path form while tmpdir() is 8.3 short here, and the tests only passed before via the projectRoot fallback.
