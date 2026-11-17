---
id: KIT-T1332
title: process failure + prose-ask gate miss (road-generator, 2026-11-16 ~19:30, main thread): the crest-rework report to the maintainer carried 'S
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-17T02:40:50Z
updated: 2026-11-17T02:40:50Z
---

## Description
process failure + prose-ask gate miss (road-generator, 2026-11-16 ~19:30, main thread): the crest-rework report to the maintainer carried 'Still wrong, your call:' over a list of ready decisions (steepness, flat tops, exponent, peak) and the earlier crest report said 'That's your call', with NO AskUserQuestion that turn; the Stop gate prose-ask (KIT-T1130/T1136/T1151, KIT-D168) did not block either reply. Root cause to find: why prose-ask missed 'your call' in a bulleted lead-in and a mid-message sentence (the reply ended with a UAT line, notices and no question; the gate may only scan the final paragraph, or exempt replies after a subagent hand-back / compaction). Prevention: scan the whole reply for the banned phrases (your call, up to you, your choice, want me to, let me know, waiting on you) outside quotes and code, and block when no questionnaire reached him that turn; test with these two replies.

kit-bug-shape: cap:bug:process-failure-prose-ask-gate-miss-road-generat:31038786
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Finding (road-generator session 4100d9bf, transcript rows 6659 and 6998): both replies carry a hard phrase in their final message; cutting the transcript at each and running hooks/prose-ask-gate.mjs blocks both (exit 2), turnCalls finds 0 AskUserQuestion calls in both turns. So the matcher, the questionnaire exemption and firstSighting did not cause the miss for these two replies. The session never printed a prose-ask block in 179 Stop runs, and every stop_hook_summary lists 13 hooks where hooks.json lists 14, with 'command hook 10' = land-alert (twelfth in hooks.json): two Stop hooks before it were not loaded, consistent with prose-ask-gate and process-failure-dispatch (added together in 167e49c); cause not proven (plugin cache 0.1.55 export vs hooks.json at session start). Separate real gap fixed: the gate read only the closing message, so a hard phrase in an earlier message of the turn (before a tool call or hand-back) never counted. Now every message of the turn is scanned for hard phrases (soft asks stay closing-only). Tests: hooks/prose-ask-gate.test.mjs 177 passed (4 failed before the fix). Probe runs filed KIT-T1333 and KIT-T1334; both marked superseded.
Update after replay: running the sealed runtime 98ce0aa through compat-run with a real Stop payload (cwd, last_assistant_message) blocks both replies (exit 2); no block-once state file and no process-failure ticket exists for session 4100d9bf, so the gate exited before matching or never loaded. Per-session Stop hookCount in the transcripts (stop_hook_summary): 12 (sessions of Nov 7-10), 13 (Nov 11-13 starts), 15 (humanoid, pixelvision Nov 15-16, which DID get prose-ask blocks); road-generator 4100d9bf, bf054b5b, d7f52e60 are all 13: their loaded Stop list predates the prose-ask-gate wiring (167e49c, Nov 13), so prose-ask-gate and process-failure-dispatch never ran there. Cause of the stale list in 4100d9bf (long-lived or resumed session keeping its start-time wiring) not proven. Also fixed: earlier-message scan now only reads blocks written after the newest Stop run (turnText afterStop).

## History
- [2026-11-17 02:40] (created) bug — process failure + prose-ask gate miss (road-generator, 2026-11-16 ~19:30, main thread): the crest-rework report to the maintainer carried 'S
- [2026-11-17 02:50] (landed) 045ccea prose-ask gate: a hard phrase in any message of the turn blocks, not only the closing one (implements KIT-T1332)
