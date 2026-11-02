---
id: KIT-D128
title: Every ticket, decision or question id shown to the maintainer carries what it is in plain words
summary: The maintainer does not know an item by its id. Anything he reads (questionnaire, reply, receipt, hand-off) states what each id is about beside it, in words that stand alone; an id is never the only description.
date: 2026-11-01
supersedes: 
source: Chris 2026-11-01, infra session, AskUserQuestion answer on the KIT-T703 scope question
---


**Decision:** Every id the maintainer reads (ticket, decision, question, commit) comes with a plain-words description of what it is, enough to answer or act without looking it up. This applies to AskUserQuestion questions and options, replies, receipts and hand-off messages. A questionnaire question must make sense with the id removed. The id may follow the description as a pointer; it never replaces it.

**Maintainer:** Chris, verbatim, 2026-11-01, answering "Which ticket types should the KIT-T703 brief check cover?": "How many fucking times have I told you I don't implicitly know what the fuck a ticket is by it's ID?"

**Why:** the maintainer runs many sessions and hundreds of tickets; an id alone forces him to look it up or guess, and a question he cannot read is a question he cannot answer. He has said so repeatedly and no rule recorded it, so it kept recurring.

**Assistant-added:** the question that triggered this named "the KIT-T703 brief check" and "ticket types" without saying what the check does. The first question in the same questionnaire described it; the second leaned on that context instead of standing alone. Enforcement belongs in a hook on AskUserQuestion (and the Stop receipt), filed as a kit bug.
