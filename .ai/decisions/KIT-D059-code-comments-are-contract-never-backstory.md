---
id: KIT-D059
title: Code comments are contract, never backstory — no quoted discussion in source
summary: Source comments carry the contract only - no history, no ticket archaeology, no quoted conversation; fix backstory on sight.
date: 2026-08-06
supersedes:
source: conversation 2026-08-06 (Chris, verbatim); exemplar stiletto-2349 crates/stiletto-game3d/src/parts/lamp.rs
---

**Decision:** Comments in shipped source document the contract only: doc comments say what the
thing is and how to use it; inline comments carry only a why the code cannot show (tradeoff,
external-bug workaround with link, intentional violation of an apparent best practice). Banned
outright: development history, ticket archaeology, multi-paragraph rationale, and — absolutely —
quoted maintainer conversation (attribution, informal language, swearing). Persistent rationale
gets at most a bare ticket/decision id, and usually not even that. Any agent touching a file that
carries backstory comments rewrites them as part of the change (fix on sight). Landed in the base
contract: `user-config/CLAUDE.global.md` § SELF-COMMENTING CODE (KIT-T205).

**Why:** Chris, 2026-08-06: "There's no reason for 3 paragraphs of comments referencing anything
more than a ticket or brief summary for the reasoning, and honestly, code comments shouldn't even
do that. They should just explain what the thing is and how to use it, not its backstory." The
exemplar (lamp.rs) shipped a 28-line module doc quoting his informal remarks verbatim and
narrating two prior bugs — content he never wants a third party to read. The story already lives
in git and the ticket store; duplicating it in source rots, leaks private discussion, and buries
the actual contract.

Rejected: "ticket reference + brief reasoning summary allowed freely" — Chris explicitly walked
that back in the same breath; the ceiling is a bare id, reluctantly.
