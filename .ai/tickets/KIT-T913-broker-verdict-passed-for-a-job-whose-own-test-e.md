---
id: KIT-T913
title: broker verdict 'passed' for a job whose own --test exited 101: j-mw9ftd53-vcbg91 (DE-T291, dirt-empire, 2026-11-09) ran crossing_continuity,
type: bug
status: todo
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-09T16:41:02Z
updated: 2026-11-09T16:41:02Z
---

## Description
broker verdict 'passed' for a job whose own --test exited 101: j-mw9ftd53-vcbg91 (DE-T291, dirt-empire, 2026-11-09) ran crossing_continuity, which exited 101 (train-j-mw9fiibe-enh2bb-19.log), but the broker judged it 'foreign' because the test also fails at HEAD, and finished.log reads 'passed'. A job submitted to FIX a red test is reported green while that test is still red; a worker or orchestrator trusting finished.log would land a non-fix. A command named in the job's own --test list must decide the job's verdict; 'foreign' may only apply to tests the job did not name, and the result line should say 'still red (also red at HEAD)'.

kit-bug-shape: cap:bug:broker-verdict-passed-for-a-job-whose-own-test-e
first seen in dirt-empire. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-11-09 16:41] (created) bug — broker verdict 'passed' for a job whose own --test exited 101: j-mw9ftd53-vcbg91 (DE-T291, dirt-empire, 2026-11-09) ran crossing_continuity,
- [2026-11-09 17:43] (landed) 13016f7 broker verdict: a test the job names in its own command (--test binary or filter) fails the job when red, reported 'stil
