---
id: KIT-D096
title: One broker per repo whose builds are long, compiled and share one build dir; it brokers only that repo's writes, and unbrokered repos never wait on it
summary: per-repo queues (Rust, C++/CMake); a submodule has its own queue shared by every checkout that pushes it; a pin job waits only for the exact sha it pins; claude-kit and Node repos are never brokered
date: 2026-10-15
supersedes: 
source: Chris 2026-10-15, relayed by stiletto-2349-2a; KIT-T482#14,
---


**Decision:**
- **One broker per repo whose builds are long, compiled and share one build dir** (Rust with cargo `target/`; C++/CMake such as GrooveGrid). It brokers only that repo's writes.
- **A submodule gets its own queue** (rapid-game inside stiletto), shared by every checkout that pushes it, so pushes from two checkouts serialize through it.
- **No repo waits on another repo's jobs or publishes**, except that a pin job waits for the exact sha it pins.
- **Non-compiled repos (claude-kit, Node/TS) are never brokered.** Kit agents write directly and never wait on, or hold up, a Rust broker. The dispatch guard never treats an unbrokered repo as broker-owned.
- Whether GrooveGrid needs a broker depends on whether its sessions run concurrent builds into one build dir; not yet measured.

**Chris, verbatim (2026-10-15):**
- "KIT stuff is a different repo and it SHOULD NOT be blocking or blocked."
- "THE BROKER SHOULD ONLY BE BROKERING WRITES ON A REPO LEVEL."
- "IT SHOULD NOT BE ACROSS THE FUCKING BOARD"
- "I also said it's not really an issue with non-rust projects."
- "It might be an issue with GrooveGrid, which is C++ based, if concurrent builds are trying to happen."

**Why:** the stiletto daemon brokered rapid-game jobs in one serial queue (a 1-minute stiletto job waited about 20 minutes behind two rapid-game gate builds), its resume waited on a kit publish, and kit work queued behind a session's standing kit writer. Cross-repo serialization buys nothing: only builds sharing one build dir conflict.

**Rejected:**
- A claude-kit broker (KIT-T482#14, withdrawn in #15): Node builds are short and share no build dir.
- One daemon for all repos: the cross-repo waits above.
