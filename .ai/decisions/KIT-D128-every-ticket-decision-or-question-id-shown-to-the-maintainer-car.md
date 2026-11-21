---
id: KIT-D128
title: Everything the maintainer reads names a thing by what it does; ticket, decision, lever and run ids are left out
summary: Everything the maintainer reads names a thing by what it does; ticket, decision, lever and run ids are left out entirely, not even after the words. Only a commit hash may appear, in the landing receipt.
date: 2026-11-01
supersedes: 
source: Chris 2026-11-01, infra session; tightened by Chris 2026-11-21, road-generator session
no_work: built by KIT-T1462 and KIT-T1463
revised: 2026-11-21
---


**Decision:** Everything the maintainer reads (questionnaire questions and options, replies, receipts, hand-offs) names a thing by what it does, in words that stand alone. Ticket, decision, question, lever and run ids are left out entirely: not first, not after the words, not in brackets. Shorthand such as stage or lever labels is explained the first time. A list of agent or run ids a hook relayed is summarised, never pasted. Only a commit hash may appear, in the landing receipt, after the words. Ids stay in briefs, commit messages, tickets and the record. This tightens the first wording, which let the id follow the description as a pointer.

**Maintainer:** Chris, verbatim, 2026-11-01, answering "Which ticket types should the KIT-T703 brief check cover?": "How many fucking times have I told you I don't implicitly know what the fuck a ticket is by it's ID?"

**Maintainer (2026-11-21):** "It should have already been mentioned in some kind of context primer to never just speak to me and take IDs. I don't know what the fuck they represent." And: "Ticket IDs. There is almost never going to be a time where I know what the fuck you're talking about by referencing a ticket ID."

**Why:** the maintainer runs many sessions and hundreds of tickets; an id alone forces him to look it up or guess, and an id after the words still clutters what he reads. He has said so repeatedly and the first wording left the id in place, so it kept recurring.

**Assistant-added:** the Stop gate `bare-ids` warns on a closing reply that carries one (KIT-T1462), and the standing-rules block carries the rule at the top of every session and agent start (KIT-T1463).
