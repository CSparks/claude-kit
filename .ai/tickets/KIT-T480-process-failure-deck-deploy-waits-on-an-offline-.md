---
id: KIT-T480
title: Process failure: deck-deploy waits on an offline Deck for hours, and a deck-deploy watch is spawned as a side effect of cap and inherits its stdio
type: bug
status: review
priority: high
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-14T16:40:34Z
updated: 2026-10-14T17:01:05Z
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] deck-deploy checks the Deck answers (TCP to its ssh port, 5 s) before any build; unreachable exits 3 at once with 'MAINTAINER ACTION: Deck unreachable ... wake it and connect Wi-Fi' and an alert orient shows (scripts/deck-deploy.test.mjs, devices.test.mjs)
- [x] watch never waits on an offline Deck (exits 3 at start and before each redeploy) and never holds its caller (detached, log file) (scripts/deck-deploy.test.mjs)
- [x] Base CLAUDE.md: an unreachable device is a maintainer action announced at once; one standing kit agent per session, replayed by orient (scripts/kit-bug.test.mjs)

## Plan
1.

## History
- [2026-10-14 16:40] (created) bug — Process failure: deck-deploy waits on an offline Deck for hours, and a deck-deploy watch is spawned as a side effect of cap and inherits its stdio
- [2026-10-14 16:48] (comment) @claude: DESCRIPTION. The ticket body Edit was refused by the auto-mode classifier; this comment carries it. (full comment #1 in ## Notes)
### comment #1 [2026-10-14 16:48] @claude
DESCRIPTION. The ticket body Edit was refused by the auto-mode classifier; this comment carries it.
Chris 2026-10-14 (verbatim): "Deck deploy has been running for 3 hours and the timer stopped. That seems like a big fucking process failure." / "If deck deploy can't run, it shouldn't wait. It likely means _I_ need to be notified to make sure the deck is available."
Facts (orchestrator): (1) With the Deck (192.168.1.107) offline all night, a `deck-deploy watch` daemon (bin/deck-deploy watch -> scripts/deck-deploy.mjs watch) ran with no output. (2) A detached instance started about 5 min before it was killed held the stdout of `node cap.mjs --project claude-kit bug ...`, ran a WSL release build of dirt-empire and hung that cap call. (3) Orchestrator half: the orchestrator also ran a hand-written 6 h ssh poll against the offline Deck, a background wait on something only the maintainer could fix.

SPAWNER FINDING. No kit code path starts deck-deploy. q code "deck-deploy" / "bin/deck-deploy" / "deck" --path hooks: the only reference outside the script is scripts/devices.mjs, which builds a command STRING that orient prints. code-graph importers-of scripts/deck-deploy.mjs = []. No deck reference in hooks/hooks.json, ~/.claude/settings.json, .githooks/* (post-checkout/merge/rewrite, pre-push), dirt-empire hooks, ~/.bashrc / .bash_profile / .profile, or the shell snapshots. The hang fits a watcher launched in the background from a shell call whose stdout pipe it inherited (the Bash tool waits until every holder of its pipe closes), not a cap/commit/hook side effect. The fix makes that impossible: `watch` now detaches with its output in a log file and returns at once.

DECISION TEXT (proposed KIT-D093; the decision-file Write was refused by the classifier, same as the KIT-T472 one). Chris, verbatim: "Please spin up an agent to handle any kit fixes like that. That should be policy." Every session keeps ONE standing kit agent: a writer in the claude-kit checkout, reused warm for each fix. The moment a kit misbehaviour shows up, the orchestrator hands it over whole: filing the ticket, diagnosis, fix with tests, npm test, publish:runtime. The orchestrator does no inline kit diagnosis; it relays the runtime sha and returns to its own work. Why: this session the orchestrator hunted the deck-deploy watcher's launcher itself and ran its own 6 h ssh poll. A warm kit agent already holds the kit context and checkout. Rejected: a fresh agent per fix (cold every time); orchestrator triage before the hand-off (the same inline diagnosis). Carried in user-config/CLAUDE.global.md under the KIT-T286 rule and replayed by orient with DISPATCH NOW.
- [2026-10-14 16:48] (comment) criterion added: deck-deploy checks the Deck answers (TCP to its ssh port, 5 s) before any build; unreachable exits 3 at once with 'MAINTAINER ACTION: Deck unreachable ... wake it and connect Wi-Fi' and an alert orient shows (scripts/deck-deploy.test.mjs, devices.test.mjs)
- [2026-10-14 16:48] (comment) criterion added: watch never waits on an offline Deck (exits 3 at start and before each redeploy) and never holds its caller (detached, log file) (scripts/deck-deploy.test.mjs)
- [2026-10-14 16:48] (comment) criterion added: Base CLAUDE.md: an unreachable device is a maintainer action announced at once; one standing kit agent per session, replayed by orient (scripts/kit-bug.test.mjs)
- [2026-10-14 16:48] (comment) ticked: deck-deploy checks the Deck answers (TCP to its ssh port, 5 s) before any build; unreachable exits 3 at once with 'MAINTAINER ACTION: Deck unreachable ... wake it and connect Wi-Fi' and an alert orient shows (scripts/deck-deploy.test.mjs, devices.test.mjs)
- [2026-10-14 16:48] (comment) ticked: watch never waits on an offline Deck (exits 3 at start and before each redeploy) and never holds its caller (detached, log file) (scripts/deck-deploy.test.mjs)
- [2026-10-14 16:48] (comment) ticked: Base CLAUDE.md: an unreachable device is a maintainer action announced at once; one standing kit agent per session, replayed by orient (scripts/kit-bug.test.mjs)
- [2026-10-14 17:00] (comment) @claude: Spawner check on the coordinator's pointer (read-only): claude-kit-data core.hooksPath = D:\dev\claude-kit\.githooks; it (full comment #2 in ## Notes)
### comment #2 [2026-10-14 17:00] @claude
Spawner check on the coordinator's pointer (read-only): claude-kit-data core.hooksPath = D:\dev\claude-kit\.githooks; its .git/hooks holds only samples; it tracks no .githooks; global and system core.hooksPath are unset. So a cap push to claude-kit-data runs only the kit pre-push (LFS where opted in, then the repo-hook chain, which finds none there). Its post-checkout/merge/rewrite run hydrate-db and LFS only. The kit's detached spawns are the broker daemon (broker/ensure.mjs) and q-server (q-client.mjs), both stdio ignore. cap.mjs has no spawn. No deck reference in ~/.claude configs outside the runtime copies. Launcher not identified; the detached-watch fix makes the stdio hold impossible either way. Runtime 4969079 published, npm test green.
- [2026-10-14 17:01] (status) todo → review
- [2026-10-14 18:31] (comment) @claude: Decision recorded as KIT-D094 through t decide (KIT-T481); base CLAUDE.md, orient and kit-bug now cite KIT-D094.
