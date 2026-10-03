---
id: KIT-T304
title: q gap: a grep followed an empty q code for the same terms
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-03T10:11:55Z
updated: 2026-10-03T16:58:16Z
---

## Description
q: q code "MaterialsPlugin\|fn probe_app\|AssetPlugin" --regex --lang rust --path crates/testkit/src -l then grep: add_plugins\|MaterialsPlugin\|AssetPlugin\|DefaultPlugins\|build_app\|fn 

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in stiletto-2349. Filed automatically (KIT-T286): every kit bug is a ticket and an agent dispatched to fix it.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] q code --regex reads grep's \| as alternation when no bare | is present

## Plan
1.

## History
- [2026-10-03 10:11] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-10-03 16:58] (comment) criterion added: q code --regex reads grep's \| as alternation when no bare | is present
- [2026-10-03 16:58] (comment) ticked: q code --regex reads grep's \| as alternation when no bare | is present
- [2026-10-03 16:58] (comment) @sonnet55: cause confirmed: 'q code "A\|B" --regex' returned nothing because JS regex reads \| as a literal pipe (grep BRE alternat (full comment #1 in ## Notes)
### comment #1 [2026-10-03 16:58] @sonnet55
cause confirmed: 'q code "A\|B" --regex' returned nothing because JS regex reads \| as a literal pipe (grep BRE alternation); the agent then grepped. breAlternation rewrites \| to | when the pattern has no bare | and --regex is set. Original T304 description was truncated by KIT-T309; cause derived from its 300-char prefix and reproduced. Tests: scripts/code-index.test.mjs (+1; negative controls: bare | untouched, no --regex untouched, literal search finds nothing); mutation (no breAlternation) fails it. code-index 16, q 102 passed.
- [2026-10-03 16:58] (status) todo → review
