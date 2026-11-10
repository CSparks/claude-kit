---
id: KIT-T951
title: source-shell-gate redirect hole: a kit-led segment returns before the redirect scan, so 'q code x > hooks/a.mjs' (a kit verb with a redirect
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-10T17:51:31Z
updated: 2026-11-10T18:09:12Z
---

## Description
source-shell-gate redirect hole: a kit-led segment returns before the redirect scan, so 'q code x > hooks/a.mjs' (a kit verb with a redirect into a source path) is allowed; found by the KIT-T939 fix agent 2026-11-10 (hooks/lib/shell-write-scan.mjs kitLed path). Also node -r ./evil.js foo.mjs stays unscanned for non-kit scripts (preloaded module code is invisible); decide fail-closed policy.

kit-bug-shape: cap:bug:source-shell-gate-redirect-hole-a-kit-led-segmen
first seen in groovegrid. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] A redirect into a source path is blocked on every segment, kit-led or git-led, quoted or escaped-quote; a > inside a quoted kit pattern still passes
- [x] A node call loading a scratch module through -r/--require/--import/--experimental-loader (separate or =-joined) or a data: URL is judged on that module; repo and package preloads pass

## Plan
1.

## History
- [2026-11-10 17:51] (created) bug — source-shell-gate redirect hole: a kit-led segment returns before the redirect scan, so 'q code x > hooks/a.mjs' (a kit verb with a redirect
- [2026-11-10 18:04] (landed) 182703f WIP KIT-T951: nodeLoadedModules and the redirect/loader tests (implements KIT-T951) [commit-foreign: node-args.mjs holds
- [2026-11-10 18:05] (landed) 9643864 WIP KIT-T951: attachedValue (implements KIT-T951) [commit-foreign: own edit, KIT-T953]
- [2026-11-10 18:05] (landed) 3bcdbbb WIP KIT-T951: nodeLoadedModules value reading (implements KIT-T951) [commit-foreign: own edit, KIT-T953]
- [2026-11-10 18:05] (landed) 726d262 WIP KIT-T951: nodeLoadedModules header (implements KIT-T951) [commit-foreign: own edit, KIT-T953]
- [2026-11-10 18:06] (landed) bb53656 WIP KIT-T951: redirect judged on every segment, every loaded node module judged (implements KIT-T951) [commit-foreign: o
- [2026-11-10 18:07] (landed) c94bdee WIP KIT-T951: argument control (implements KIT-T951) [commit-foreign: own edit, KIT-T953]
- [2026-11-10 18:08] (comment) criterion added: A redirect into a source path is blocked on every segment, kit-led or git-led, quoted or escaped-quote; a > inside a quoted kit pattern still passes
- [2026-11-10 18:08] (comment) criterion added: A node call loading a scratch module through -r/--require/--import/--experimental-loader (separate or =-joined) or a data: URL is judged on that module; repo and package preloads pass
- [2026-11-10 18:09] (comment) @claude: Fixed in bb53656 and c94bdee. (1) hooks/lib/shell-write-scan.mjs judgeSegment now scans redirects on every segment; a ki (full comment #1 in ## Notes)
### comment #1 [2026-11-10 18:09] @claude
Fixed in bb53656 and c94bdee. (1) hooks/lib/shell-write-scan.mjs judgeSegment now scans redirects on every segment; a kit-led or git-led segment counts only a > outside quotes (redirectTargets with outsideQuotes); the ambiguous-quoting path no longer drops kit-led pieces but judges their redirect targets with hit. Git is the same hole and is closed the same way (deliberate reading of 'every segment'). (2) node -r/--require/--import/--loader/--experimental-loader/--env-file (separate, =-joined, short) and data: URLs: new nodeLoadedModules in node-args.mjs; judgeNodeModules reads every loaded module (temp scripts judged) plus the script, data: URL bodies judged as inline code. Policy: judge, not blanket-block: repo/package preloads were authored through Edit/Write and are no worse than node repo.mjs; blanket block would stop --import tsx, -r ts-node/register, --env-file=.env. Not covered: a preload named by shell expansion (-r $(mktemp)) and a temp module created inside the same command, same limit as plain node <script>. Tests: shell-write-scan 54 (new), node-args 76, source-shell-gate, store-shell-gate, shell-writes, hand-write-detect, shell-segments all ok. Mutations (revert one fix each, via scratch copy): kit/git redirects skipped fails 8; kit redirects unmasked fails 4; ambiguous kit pieces dropped fails 2; first-script-only fails 1; loaded modules unjudged fails 7; no data URL fails 2. Filed KIT-T953: the checkout-holder and commit-gate attribute a subagent's writes to its dispatching session.
- [2026-11-10 18:09] (comment) ticked: A redirect into a source path is blocked on every segment, kit-led or git-led, quoted or escaped-quote; a > inside a quoted kit pattern still passes
- [2026-11-10 18:09] (comment) ticked: A node call loading a scratch module through -r/--require/--import/--experimental-loader (separate or =-joined) or a data: URL is judged on that module; repo and package preloads pass
- [2026-11-10 18:09] (status) todo → review
