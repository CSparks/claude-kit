---
id: KIT-D147
title: A block is never retried or worked around; the turn that hits it prevents the next one
summary: on any hook, gate or classifier block the session fixes the cause for good in the same turn: kit ticket plus fix agent (KIT-D145) and the session-side cause, never a bare retry
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris, stiletto-2349)
---


**Maintainer:** "Protocol on running into blocks is to fucking PREVENT IT FROM HAPPENING AGAIN." Earlier: "WHY the fuck are you running into so many blocks?" and "These need to be fucking resolved."

**Maintainer (same turn):** "NOT BY BYPASSING IT BUT BY MAKING SURE THE FUCKING BLOCK IS FUNCTIONING CORRECTLY AND THE PROTOCOL IS FUCKING DOCUMENTED IN THE RIGHT FUCKING PLACE."

**Decision:** Prevention never means bypassing. A block is made to function correctly (it fires only on a real violation, reads its input correctly, and lists every requirement on the first rejection), and its protocol is documented in one right place per gate: the gate's own rejection text and `q gates <gate>` (derived from the gate code, never a hand-kept copy), plus one pointer in the base CLAUDE.md HOOK CONTRACT section and in orient's identity block. When a hook, gate or auto-mode classifier blocks a call, the session does three things the same turn: (1) satisfies the block without routing around it; (2) files the kit ticket and dispatches the fix agent (KIT-D145) when the block is a kit bug, a missing requirement printout, or a stale instruction; (3) removes the session-side cause (a stale note, an unread protocol, a missing template) so the same block cannot recur. A repeat of a block already seen in the session is a process failure. Before the first call to a gated tool (Agent, AskUserQuestion, t decide, store writes), the session reads that gate's rules: orient decisions, `q gates`, or the tool's `--help`.

**Why:** 2026-11-08 stiletto-2349 hit 13 blocks in one session: about 8 from calling before reading rules already on screen, 3 kit bugs (dirty files read as a writer, the questionnaire gate ignoring brief text, the classifier refusing a hook-rewritten dispatch), 1 legitimate holder block.

**Rejected:** retrying until it passes (wastes calls and hides the bug); a memory note alone (a reminder, not a fix); waiting for a bill before fixing the gate (KIT-D145).

**Assistant-added:** Extends KIT-D145 and KIT-D144; related KIT-T893, KIT-T894, KIT-T865.
