---
id: KIT-T700
title: Agents write source files through shell heredocs (cat > file <<EOF, tee, sed -i, node -e writeFileSync) instead of Write/Edit. The code-qual
type: bug
status: done
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-29T15:56:56Z
updated: 2026-10-29T16:07:36Z
fixed_commit: 56472fa
---

## Description
Agents write source files through shell heredocs (cat > file <<EOF, tee, sed -i, node -e writeFileSync) instead of Write/Edit. The code-quality pre-write gate (300/600-line limits, comment rules) and the commit gate's file attribution never see those files, so commits end up needing '[commit-foreign: …]' overrides. Seen 2026-10-29 in the KIT-T699 writer's commits 1c442c6 through f66903f. Per KIT-D113: a hard block on Bash/PowerShell commands that write into tracked source paths (redirects, tee, sed -i, Set-Content/Out-File, inline node/python writes), pointing to Write/Edit. Scratchpad, temp dirs and .ai stores stay allowed, with exclusions on the usual surfaces.

kit-bug-shape: cap:bug:agents-write-source-files-through-shell-heredocs
first seen in Chris Sparks. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-29 15:56] (created) bug — Agents write source files through shell heredocs (cat > file <<EOF, tee, sed -i, node -e writeFileSync) instead of Write/Edit. The code-qual
- [2026-10-29 16:07] (status) todo → done
