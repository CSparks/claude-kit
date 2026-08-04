---
id: KIT-D048
title: Work until interrupted or COMPLETE — stopping needs a reason
type: decision
status: accepted
decided: 2026-08-03
decided_by: Chris
links: [KIT-D045, KIT-T099]
---

## Decision
The working rule changes from **"Work until interrupted"** to **"Work until interrupted
or COMPLETE."**

Stopping is an action, not a checkpoint. It costs the maintainer a turn, so it needs a
reason. Stop ONLY when there is something for them to **decide**, **discuss**, or
**test**. When there is none of those, the queue is the instruction: pull the next item
and keep going.

Chris, 2026-08-03: *"If there's nothing for me to decide, discuss or test, you shouldn't
have stopped working and that should be in your directive in Claude Kit."* … *"Work
until interrupted or COMPLETE."*

## Why
"Work until interrupted" was already in the contract and was not enough — it says what
to do while working, not when handing back is legitimate. In practice the assistant kept
treating *a completed ticket* as a natural stopping point: land it, write a summary, wait.
That silently converts every ticket boundary into a maintainer turn, which is exactly the
batching the kit's one-line-receipt rule exists to prevent.

The three legitimate reasons to hand back are the three things only the maintainer can
supply: a **decision**, a **conversation**, or **UAT**. Everything else — finishing work,
reporting progress, feeling like a natural pause — is the assistant stopping for its own
convenience.

## What it does NOT mean
- It does not weaken the **UAT receipt** (KIT-T099): a landing the maintainer can try IS
  a reason to hand back, and that receipt is the point of doing so.
- It does not weaken **file-changing work requires approval**: unapproved work is not
  "the next item".
- It does not license silence. Receipts still ride along — they travel WITH the next
  turn's work rather than instead of it.
- It does not turn decisions into pauses: a genuine choice goes in an AskUserQuestion,
  which is a question, not a stop.

## Consequences
- `user-config/CLAUDE.global.md` WORKING RULES updated; the composed `~/.claude/CLAUDE.md`
  picks it up on the next `bootstrap.sh`.
- Candidate for hook enforcement later: a Stop-time check that fires when a turn ends
  with no question asked, no UAT receipt, and unstarted items in the drain — the same
  shape as the land-alert and anchor-ratchet gates. Not built yet; noted so it is not
  re-derived.
