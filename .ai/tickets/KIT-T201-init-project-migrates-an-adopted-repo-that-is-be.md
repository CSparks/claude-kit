---
id: KIT-T201
title: init-project MIGRATES an adopted repo that is behind the template instead of skipping it
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-08-06T02:29:32Z
updated: 2026-08-06T02:29:32Z
---

## Description
Promoted verbatim from the inbox capture (untriaged until 2026-08-06):

> (feature) init-project MIGRATES an adopted repo that is behind the template, instead of skipping it. Chris, 2026-08-05: 'Does claude kit migrate changes when running in a repo that is behind the template?' ... 'It should.' TODAY IT DOES NOT. Verified in scripts/init-project.mjs: the CLAUDE.md contract is appended ONCE and thereafter matched on MARKER and skipped ('CLAUDE.md already has the workflow contract - skipped'), and .ai/config.yml is scaffolded at adopt time with no backfill of keys added later. So a repo adopted months ago silently keeps that era's contract and config forever. WHAT ALREADY PROPAGATES (by design, keep it): hooks, because installGitHooks only sets core.hooksPath to the kit's live .githooks dir rather than copying files, so hook edits reach every adopted repo instantly; kit scripts, invoked by path; .gitignore, which is additive. WANTED: (a) a template VERSION stamped into the adopted repo (in .ai/config.yml or a marker in the CLAUDE.md block) so 'behind' is detectable at all; (b) init-project --migrate that reconciles the contract block and backfills new config keys WITHOUT clobbering project-local edits - the contract block is delimited, so replacing just that block is tractable; (c) SessionStart orient surfaces 'this repo is N template versions behind' so drift is visible rather than discovered. CAUTION to encode: the live-hooks design means a bad hook edit hits every project at once - that is exactly how a 'git lfs install --force' wiped the KIT-T097 hydrate hooks for all repos on 2026-08-04.

Provenance: `.ai/inbox/triaged/2026-08-05-1534-init-project-migrates-an-adopted-repo-that-is-be.md`.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] running init-project in a repo that is behind the template MIGRATES it: the contract block and config keys are brought forward
- [ ] migration is idempotent and reports exactly what it changed
- [ ] hand-edited local content is preserved (or the conflict is reported), never silently overwritten
- [ ] a test adopts a repo at an old template revision and asserts the migration result

## Plan
1.

## History
- [2026-08-06 02:29] (created) feature — init-project MIGRATES an adopted repo that is behind the template instead of skipping it
- [2026-08-06 02:31] (comment) criterion added: running init-project in a repo that is behind the template MIGRATES it: the contract block and config keys are brought forward
- [2026-08-06 02:31] (comment) criterion added: migration is idempotent and reports exactly what it changed
- [2026-08-06 02:31] (comment) criterion added: hand-edited local content is preserved (or the conflict is reported), never silently overwritten
- [2026-08-06 02:31] (comment) criterion added: a test adopts a repo at an old template revision and asserts the migration result
