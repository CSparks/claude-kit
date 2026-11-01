---
id: KIT-T727
title: flush.mjs reports remote-host and home paths in SESSION.md (/srv/showtimewarp/.env, ~/.ssh, ~/.claude/settings.json) as missing repo artifac
type: bug
status: review
priority: high
milestone:
labels: [kit-bug]
links: []
files: []
supersedes:
superseded_by:
created: 2026-10-30T16:08:05Z
updated: 2026-10-30T21:18:22Z
---

## Description
flush.mjs reports remote-host and home paths in SESSION.md (/srv/showtimewarp/.env, ~/.ssh, ~/.claude/settings.json) as missing repo artifacts; infra SESSION cites server paths by design. Also mangles 'infra/.secrets' into 'infra/.secret'.

kit-bug-shape: cap:bug:flush-mjs-reports-remote-host-and-home-paths-in-
first seen in infra. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-10-30 16:08] (created) bug — flush.mjs reports remote-host and home paths in SESSION.md (/srv/showtimewarp/.env, ~/.ssh, ~/.claude/settings.json) as missing repo artifac
- [2026-10-30 21:18] (landed) 1d914f7 Skip host and home paths in SESSION citation check; implements KIT-T727
- [2026-10-30 21:18] (status) todo → review
