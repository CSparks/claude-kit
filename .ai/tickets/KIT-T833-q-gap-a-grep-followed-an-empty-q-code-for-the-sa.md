---
id: KIT-T833
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
created: 2026-11-02T18:48:42Z
updated: 2026-11-02T22:51:46Z
---

## Description
q: q code "pub fn" --path rapid-game/rust/core/rg-ik 2>&1  then  grep: pub fn\|pub struct

kit-bug-shape: q-gap:grep-after-empty-q:code
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Cause: a --regex pattern in grep BRE dialect with a bare paren (getNumBuses( *kEvent) did not compile in JS, so q answered invalid pattern and the agent grepped. scripts/q-grep-pattern.mjs now retries with unescaped parens as literals (breAlternation moved there); a balanced group stays a group. Tests: q-gaps 13 passed, code-index 27. The rg-ik 'pub fn' case no longer reproduces (q finds rg-ik/src/chain.rs hits; the crate's last commit was within a day of the report, so the index was stale or the report predates it); not changed.

## History
- [2026-11-02 18:48] (created) bug — q gap: a grep followed an empty q code for the same terms
- [2026-11-02 19:02] (comment) seen again in groovegrid: q: q code 'addEventOutput\|getNumBuses( *kEvent\|kEvent' --regex --dir "$J/modules/juce_audio_plugin_client/VST3" -C1 2>&1 then grep: kEvent
- [2026-11-02 22:51] (status) todo → review
- [2026-11-02 22:51] (landed) 5882693 t config get|set edits one .ai/config.yml key with broker keys checked against the reader (config-edit 11 passed, t-verb
