---
id: KIT-T199
title: wire the never-auto-commit-binaries policy into the init prompt and the project template
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T200]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:31Z
updated: 2026-08-06T02:29:31Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> directive NEVER auto-commit binary/LFS files - commit them ONLY when the maintainer directly asks. Chris, verbatim 2026-08-04: 'If we need to set a policy to NOT auto-commit LFS files and only do it when directly prompted by the user, we can do that and it should be in Claude Kit's init prompt.' Context: stiletto-2349 is adopting Git LFS for 100-300 texture images with a handful of revisions each. Binaries are unlike code: a wrong commit is expensive (permanent history, LFS quota, slow clones) and cannot be pruned without a history rewrite, so the default must be hands-off. WANTED: (a) a line in init-project's generated CLAUDE.md - agents stage and commit source freely but never stage an image/binary/LFS-tracked file unless explicitly asked; (b) consider a commit-gate check that blocks a commit staging LFS-tracked or known-binary extensions without an explicit [binary-ok: reason] token, matching the existing gate style. Applies to every adopted repo, not just stiletto.

Provenance: `.ai/inbox/triaged/2026-08-05-0009-directive-never-auto-commit-binary-lfs-files-com.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] the never-auto-commit-binaries policy is stated once at kit level and reaches every project through init-project
- [ ] the project template carries it, so an adopted repo gets it without a manual copy
- [ ] a test asserts a freshly initialised project's contract contains the policy

## Plan
1.

## History
- [2026-08-06 02:29] (created) feature — wire the never-auto-commit-binaries policy into the init prompt and the project template
- [2026-08-06 02:31] (comment) criterion added: the never-auto-commit-binaries policy is stated once at kit level and reaches every project through init-project
- [2026-08-06 02:31] (comment) criterion added: the project template carries it, so an adopted repo gets it without a manual copy
- [2026-08-06 02:31] (comment) criterion added: a test asserts a freshly initialised project's contract contains the policy
