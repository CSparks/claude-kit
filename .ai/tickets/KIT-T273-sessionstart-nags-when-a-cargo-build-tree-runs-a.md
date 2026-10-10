---
id: KIT-T273
title: SessionStart nags when a cargo build tree runs away: cargo never collects target/, so it grows without bound until someone looks
type: feature
status: todo
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-09-06T01:04:04Z
updated: 2026-09-06T01:04:04Z
---

## Description
Cargo has no garbage collector. Artifact filenames are content-hashed, so every rebuild writes a
new set beside the old one and nothing ever removes the predecessor. rustc prunes an incremental
session directory only on a CLEAN finalize, so every crash, Ctrl-C and failed link orphans one.
Nothing in the toolchain notices, and nothing in the workflow was watching.

Found on stiletto 2026-09-06 after a crash recovery: target/ had reached **1,002.3 GB** against a
**67 MB** shipped game exe - roughly 18 uncollected generations. deps/*.pdb alone was 533.9 GB
across 1,517 files averaging 354 MB; incremental/ was 252.8 GB across 673,501 files in 4,728
session dirs dating back 11 days. A corrupted incremental session from the crash also broke that
repo's gate at the LINK step, so this is a correctness risk and not only a disk one.

The check trips on directory ENTRY COUNTS, which is a readdir and stays fast at any size, and only
sums bytes once a count has already tripped - so a healthy tree costs nothing at SessionStart.
Calibrated against a freshly built stiletto tree: 1,611 deps entries when clean, 40,811 when
bloated. It is deliberately NOT gated on .ai/ adoption: a runaway target/ costs the disk whether
or not the repo opted into the workflow store.

DELIBERATELY NOT AUTOMATED: the hook reports and hands over the command, it does not delete. An
auto-clean at SessionStart would cold-rebuild whatever the user was about to work on, which is a
worse morning than the disk usage. Revisit only on an explicit ask.

## Acceptance Criteria
- [x] housekeeping.mjs reports a runaway build tree at SessionStart, naming the real numbers and
      carrying its own drain command
- [x] The check is cheap on a healthy tree (counts first, bytes only after a count trips) and
      silent on non-cargo repos
- [x] Tested at both thresholds with negative controls, including a repo with no target/ at all
- [ ] Thresholds re-checked against a second project (stiletto calibrated them alone)

## Plan
1.

## History
- [2026-09-06 01:04] (created) feature — SessionStart nags when a cargo build tree runs away: cargo never collects target/, so it grows without bound until someone looks
