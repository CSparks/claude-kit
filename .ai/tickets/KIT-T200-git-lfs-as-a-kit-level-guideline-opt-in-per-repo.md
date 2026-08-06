---
id: KIT-T200
title: Git LFS as a kit-level guideline, opt-in per repo, chained onto the existing hydrate git hooks
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T199]
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:31Z
updated: 2026-08-06T02:29:31Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (feature) Git LFS support as a KIT-LEVEL guideline, opt-in per repo. Chris, verbatim 2026-08-05: 'Kit level guidelines. Ask before using per repo and remember.' WANTED: (a) the kit knows how to wire LFS correctly - chain git lfs post-checkout/post-merge/pre-push ONTO the existing KIT-T097 hydrate hooks in .githooks/ rather than replacing them; (b) enabling LFS in any given repo is ASK-FIRST, never a default, and the answer is recorded in that project's .ai/ so it is not re-litigated; (c) documented in init-project's guidance alongside the never-auto-commit-binaries directive (inbox 2026-08-05-0009). HARD WARNING to encode: NEVER run 'git lfs install --force'. core.hooksPath commonly points at claude-kit's SHARED .githooks, and forcing silently overwrote the KIT-T097 hydrate post-checkout/post-merge for EVERY adopted project (happened 2026-08-04, restored from git). The kit's own installer should detect core.hooksPath and merge rather than overwrite. VERIFIED FACTS for the guidance: GitHub LFS quota is PER ACCOUNT (repo owner's), 10 GiB storage + 10 GiB/month bandwidth on Free AND Pro, 250 GiB on Team/Enterprise Cloud; pre-paid data packs are GONE, replaced by metered billing; bandwidth counts DOWNLOADS only; deleting objects does NOT refund the current month (storage recalculates on the 1st).

Provenance: `.ai/inbox/triaged/2026-08-05-1447-git-lfs-support-as-a-kit-level-guideline-opt-in-.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] enabling LFS in a repo is ASK-FIRST and the answer is recorded in that project's store
- [ ] the LFS git hooks CHAIN onto the KIT-T097 hydrate hooks rather than replacing them
- [ ] init-project documents the LFS path alongside the never-auto-commit-binaries policy (KIT-T199)

## Plan
1.

## History
- [2026-08-06 02:29] (created) feature — Git LFS as a kit-level guideline, opt-in per repo, chained onto the existing hydrate git hooks
- [2026-08-06 02:31] (comment) criterion added: enabling LFS in a repo is ASK-FIRST and the answer is recorded in that project's store
- [2026-08-06 02:31] (comment) criterion added: the LFS git hooks CHAIN onto the KIT-T097 hydrate hooks rather than replacing them
- [2026-08-06 02:31] (comment) criterion added: init-project documents the LFS path alongside the never-auto-commit-binaries policy (KIT-T199)
