---
id: KIT-T1377
title: broker: a run known to be long can override the 1,200 s per-run limit (builds --run ... --limit <seconds> --why '<reason>'), recorded on the
type: feature
status: review
priority: medium
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-18T15:21:51Z
updated: 2026-11-18T15:31:38Z
fixed_commit: a13dc2d8
---

## Description
broker: a run known to be long can override the 1,200 s per-run limit (builds --run ... --limit <seconds> --why '<reason>'), recorded on the run; the maintainer wants this for long full-suite or batch runs. Also a compartmentalised test layout: per-crate/per-asset named test groups runnable alone.

kit-bug-shape: cap:feature:broker-a-run-known-to-be-long-can-override-the-1:21d980a0
first seen in road-generator. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [x] builds --run --limit N --why "<reason>" raises the 1200 s run limit up to 7200 s; the gate and the launcher refuse a raise with no reason or past 7200; the reason is on the run record, in builds --result and on its finished.log line (limit= why=), parsed by readFinished (scripts/broker/detached-run.test.mjs)

## Plan
1.

## Notes
Built: `builds --run "<cmd>" --out target/<file> --limit <s> --why "<reason>" --timeout 170 --tool-timeout 180`.

- The run limit stays 1200 s by default (RUN_LIMIT_S in hooks/lib/builds-run-usage.mjs). A --limit above it needs --why with a reason; none goes past 7200 s. The rule lives in one function (limitProblem, hooks/lib/builds-run-args.mjs) used by both the source-shell gate's launcher allowlist and the launcher itself, so neither path raises silently.
- The reason is recorded on the run (record.why), shown by `builds --result` and the launcher's own wait line ("limit 3000 s, raised: <reason>", while running and once ended), and written on the run's finished.log line as `limit=<s> why=<reason>`; readFinished parses both. A default run's line is unchanged.
- The foreground wait (170 s) is the --timeout window and is untouched; the raised limit only governs when the detached worker kills the run. KIT-D104's five minutes for routine operations is unchanged: the override is explicit, named and logged.
- Help: the launcher's usage notes, the gate's launcher advice and docs/BROKER.md name the form.

For road-generator's full framework suite (run-20261118144550-vi6g stopped at 1200 s while compiling): rerun with e.g. `--limit 3600 --why "full framework suite approved by the maintainer 2026-11-18"`.

Tests: scripts/broker/detached-run.test.mjs 10 pass (new: the reason on the record, in describeRun and on the finished.log line with readFinished; the launcher refuses no reason and past the ceiling, accepts a named raise; the gate's launcherProblem the same); source-shell-gate-builds-run all pass; handback 51; query-gate-finished-log 8; agent-recipes all pass.

## History
- [2026-11-18 15:21] (created) feature — broker: a run known to be long can override the 1,200 s per-run limit (builds --run ... --limit <seconds> --why '<reason>'), recorded on the
- [2026-11-18 15:30] (status) todo → doing
- [2026-11-18 15:30] (comment) criterion added: builds --run --limit N --why "<reason>" raises the 1200 s run limit up to 7200 s; the gate and the launcher refuse a raise with no reason or past 7200; the reason is on the run record, in builds --result and on its finished.log line (limit= why=), parsed by readFinished (scripts/broker/detached-run.test.mjs)
- [2026-11-18 15:30] (comment) ticked: builds --run --limit N --why "<reason>" raises the 1200 s run limit up to 7200 s; the gate and the launcher refuse a raise with no reason or past 7200; the reason is on the run record, in builds --result and on its finished.log line (limit= why=), parsed by readFinished (scripts/broker/detached-run.test.mjs)
- [2026-11-18 15:31] (landed) a13dc2d8 builds --run --limit N --why "<reason>": a run known to be long raises the 1200 s limit up to 7200 s, the reason recorde
- [2026-11-18 15:31] (status) doing → review
- [2026-11-18 15:31] (comment) runtime a13dc2d8 published
