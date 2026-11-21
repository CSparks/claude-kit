---
id: KIT-T1462
title: context primer + gate: replies to the maintainer must say what a thing is in plain words; ticket/decision/run/commit ids never stand alone (
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-21T13:35:46Z
updated: 2026-11-21T13:42:11Z
---

## Description
context primer + gate: replies to the maintainer must say what a thing is in plain words; ticket/decision/run/commit ids never stand alone (road-generator RDG-D148, maintainer: 'It should have already been mentioned in some kind of context primer to never just speak to me and take IDs. I don't know what the fuck they represent.'). Add the rule to user-config/CLAUDE.global.md (the coordinator contract, near the compress-every-reply rule) and to orient's replayed rules; add a Stop-gate check that warns when a closing reply has more than N bare id tokens (e.g. RDG-D146, TH-73, run-2026...) per 100 words, or a hook-relayed list of agent/run ids pasted verbatim. Reuse the prose-ask gate's reply scanner.

kit-bug-shape: cap:feature:context-primer-gate-replies-to-the-maintainer-mu:cd8d63ec
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] Stop gate warns on ticket/decision/run ids in a closing reply and passes a receipt-line commit hash (bare-id-gate.test.mjs 41 passed)
- [x] contract line and orient replay line carry the plain-words rule

## Plan
1.

## Notes
Built: hooks/bare-id-gate.mjs (Stop warning, exit 0, check-id bare-ids) over hooks/lib/bare-ids.mjs, which reuses the prose-ask reply scanner (exported ownVoice: code, quotes, blockquotes exempt) and exempts a receipt commit line. Flags any ticket, decision, lever or run id token and a pasted list of id-shaped tokens; the warning says to name the thing by what it does. Contract line in user-config/CLAUDE.global.md next to the compress rule; orient replay is the first line of the rule block (hooks/lib/rule-block.mjs, KIT-T1463). Tests: hooks/bare-id-gate.test.mjs 41 passed (negative controls: words then a hash in the receipt line, receipt line with ticket ids, code, fence, quote, blockquote, UTF-8, plain hex-letter words, subagent exempt, marker line); prose-ask-gate 232, gate-wiring 17, contract-rules 48, coordination-model 12, search-adoption 9, block-triage 13, gate-protocol 57 passed.

## History
- [2026-11-21 13:35] (created) feature — context primer + gate: replies to the maintainer must say what a thing is in plain words; ticket/decision/run/commit ids never stand alone (
- [2026-11-21 13:41] (landed) 81b35f91 bare-id-gate: a Stop warning when a closing reply to the maintainer carries ticket, decision or run ids or a pasted id l
- [2026-11-21 13:41] (comment) criterion added: Stop gate warns on ticket/decision/run ids in a closing reply and passes a receipt-line commit hash (bare-id-gate.test.mjs 41 passed)
- [2026-11-21 13:42] (comment) criterion added: contract line and orient replay line carry the plain-words rule
- [2026-11-21 13:42] (comment) ticked: Stop gate warns on ticket/decision/run ids in a closing reply and passes a receipt-line commit hash (bare-id-gate.test.mjs 41 passed)
- [2026-11-21 13:42] (comment) ticked: contract line and orient replay line carry the plain-words rule
- [2026-11-21 13:42] (status) todo → review
