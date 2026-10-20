---
id: KIT-T552
title: broker subtree reclaim takes a dead holder's tree while its git push and pre-push gate still run, and a lane replacement restores its journal into a tree the other lane holds (LF over CRLF)
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-16T22:41:23Z
updated: 2026-10-16T23:39:47Z
fixed_commit: e823ee6
---

## Description
Found in ST-T904 round 13 (runtime a066a82), 2026-10-16 22:37Z. A hard kill (taskkill /F) of the rapid-game lane daemon (pid 68000) inside the train's pre-push gate (train-j-mvbjm7ge-8educv: three RG-T041 commits 6a29fb46, 4fcfefda, 3e9083d9 on local main, origin still 4c8ea4d5).

(A) Reclaim ignores the dead holder's live command tree. 3 s after the kill the ROOT daemon (pid 36424, job j-mvbjo67z-bbwib8 waiting on the subtree lock) judged the holder dead by its daemon pid, took the rapid-game lock, and checked the submodule out at the gitlink e9cae518 — while the dead lane's `git push` (git hook run pre-push, node scripts/gate/pre-push.mjs, cargo clippy --workspace) was still running in that tree. The orphaned gate was then linting e9cae518, and a green gate would have pushed 3e9083d9 (refs resolved at push start) with no valid gate behind it. 2a killed the orphan tree by hand at 22:38:21; origin verified untouched. Root fix: whoever reclaims a dead holder's subtree lock ends (or waits out) that holder's recorded command trees (children.json) first; the lock is not free while the holder's children live. The lane's own replacement did end one (pid 11756, 22:39:03), but only when it started, 90 s after the root lane had already taken the tree.

(B) A replacement lane daemon restores its journal into a tree another lane holds. At 22:39:08 the rapid-game replacement (pid 56172) logged 'restored the tree after interrupted job train-j-mvbjm7ge-8educv; it re-runs' and then 'waiting — rapid-game tree held by lane root'. The restore wrote rust/gameplay/rg-physics-pbd/src/systems.rs and rust/core/rg-noise/src/perlin/sample.rs into the root job's checkout mid-test. Content equal to e9cae518 (blob b7f61a20 / 8eb27997) but LF bytes over a CRLF autocrlf checkout, so git status shows both M. Root fix: journal restore takes the subtree lock like any job; restore writes the checkout's line endings (or restores via git checkout of the blob), never raw LF.

Acceptance: a two-process test (subtree-drive.mjs pattern): lane holder killed mid-command with a live child; the other lane does not take the tree until the child is gone; the holder's replacement restores only under the lock; restored files are byte-identical to a git checkout of the same blob on an autocrlf=true repo.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Checked as possible duplicates and judged different work (--not-dup): KIT-T549, KIT-T517, KIT-T276
### comment #1 [2026-10-16 23:07] @claude
(C) While rapid-game is dirty, the two lanes ping-pong the subtree lock: from 23:05Z the rg lane takes it for j-mvbjm7ge-8educv, finds 'build checkout dirty', releases; the root lane takes it for idle work and yields back ('yielding to lane rapid-game, which is waiting for it'), every 5-15 s, one log line per hop in both daemon logs. A lane paused on dirty should not take (or should keep, without re-asking) the lock until the tree is clean; idle work should not take the tree while a lane job is paused on it.
### comment #2 [2026-10-16 23:39] @claude
fixed: (A) subtree.mjs reclaimStale ends the dead holder's recorded command trees (its lane's children.json, via reapOrphans) before it frees the lock, so another lane cannot take the tree while the dead lane's git push / pre-push gate still runs; chosen over waiting because the orphan serves no one (its result would never be read). (B) recover.mjs: the start-up journal restore (and resume of a landing past its commit) runs under the subtree lock of the tree it writes into, deferred per tick while another lane holds it (no job drains until it is done); takeover.mjs takes the lock too and queue.mjs treats busy as waiting. preimage restore writes a tracked file whose journalled content equals the index blob through git checkout-index -f -u, so it matches a checkout byte for byte on an autocrlf repo and reads as unmodified; other content is written exactly. Evidence: scripts/broker/subtree-reclaim.test.mjs 6 passed (lane holder killed mid-command with a live child; replacement restore waits under a root-held lock, then restores; byte-identity vs git checkout; takeover waits), 4 red before; controls: live holder's command untouched, edited content keeps exact bytes. broker glob 346 passed. One older check in takeover.test.mjs compared restored api.rs to LF literally; it now compares modulo line endings and adds a clean git status check.
### comment #3 [2026-10-16 23:59] @claude
(C) fixed: admit's dirt check moved to dirty.mjs (dirtState, one source); a dirty refusal in queue.mjs leaves target/broker/<lane>/dirty-hold.json; later polls re-check the tree with git status (no lock) and keep the lane paused until clean, then drop the hold and take the lock as usual. Idle work (queue.mjs) returns 'waiting' instead of taking a submodule tree whose lane holds a hold that is still dirty. Evidence: scripts/broker/dirty-hold.test.mjs 2 passed: 6 polls of both lanes over a dirty rapid-game tree took the lock 12 times before, at most once after; control: after the tree is cleaned the lane takes it, passes the job, clears the hold, and idle work takes it again. broker glob 348 passed.

## History
- [2026-10-16 22:41] (created) bug — broker subtree reclaim takes a dead holder's tree while its git push and pre-push gate still run, and a lane replacement restores its journal into a tree the other lane holds (LF over CRLF)
- [2026-10-16 23:07] (comment) @claude: (C) While rapid-game is dirty, the two lanes ping-pong the subtree lock: from 23:05Z the rg lane takes it for j-mvbjm7ge (full comment #1 in ## Notes)
- [2026-10-16 23:39] (comment) @claude: fixed: (A) subtree.mjs reclaimStale ends the dead holder's recorded command trees (its lane's children.json, via reapOrp (full comment #2 in ## Notes)
- [2026-10-16 23:39] (status) todo → review
- [2026-10-16 23:39] (comment) scripts/broker/subtree-reclaim.test.mjs 6 passed, glob 346 passed
- [2026-10-16 23:59] (comment) @claude: (C) fixed: admit's dirt check moved to dirty.mjs (dirtState, one source); a dirty refusal in queue.mjs leaves target/bro (full comment #3 in ## Notes)
