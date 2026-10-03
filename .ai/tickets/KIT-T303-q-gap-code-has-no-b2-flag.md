---
id: KIT-T303
title: q gap: 'code' has no -B2 flag
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T09:23:11Z
updated: 2026-10-03T16:58:04Z
---

## Description
q code pub struct SkinOptions --lang rust -B2

kit-bug-shape: q-gap:flag:code:-B2
first seen in rapid-game. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code accepts grep-style attached -B2/-A2/-C2 and --opt=value

## Plan
1.

## History
- [2026-10-03 09:23] (created) bug — q gap: 'code' has no -B2 flag
- [2026-10-03 16:54] (comment) seen again in claude-kit: q code -C 2 -B2 fileKitBug --path scripts/kit-bug.mjs
- [2026-10-03 16:58] (comment) criterion added: q code accepts grep-style attached -B2/-A2/-C2 and --opt=value
- [2026-10-03 16:58] (comment) ticked: q code accepts grep-style attached -B2/-A2/-C2 and --opt=value
- [2026-10-03 16:58] (comment) @sonnet55: cause: parseCodeArgs only took spaced '-B 2'; '-B2' fell to the unknown-flag branch and filed a gap. splitAttached norma (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:58] @sonnet55
cause: parseCodeArgs only took spaced '-B 2'; '-B2' fell to the unknown-flag branch and filed a gap. splitAttached normalises -A/-B/-C<n> and --kind/--lang/--path/--type/--limit=<v>. Tests: scripts/code-index.test.mjs (attached forms equal spaced; negative controls -Bx and --bogus=1 stay unknown); mutation (no splitAttached) fails it. code-index 15, q 102, kit-bug 15 passed.
- [2026-10-03 16:58] (status) todo → review
