---
id: KIT-T836
title: t config: set a project's .ai/config.yml key (e.g. broker.affected.conformance) through a verb, with the broker config reader validating it;
type: feature
status: review
priority: high
asked: 2
milestone:
labels: [kit-feature]
links: []
files: []
supersedes:
superseded_by:
created: 2026-11-02T19:25:38Z
updated: 2026-11-02T22:51:45Z
---

## Description
t config: set a project's .ai/config.yml key (e.g. broker.affected.conformance) through a verb, with the broker config reader validating it; today no verb edits config.yml, so an orient notice such as 'broker.affected.conformance is unset' has no sanctioned fix (dirt-empire DE-T285: conformance: cargo t -p dirt-empire --test framework_conformance)

kit-bug-shape: cap:feature:t-config-set-a-project-s-ai-config-yml-key-e-g-b
first seen in claude-kit. Filed automatically (KIT-T286): every kit bug is a ticket and needs an agent dispatched to fix it (filing dispatches nothing).

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## Notes
Added t config get|set <dotted.key> <value>...: scripts/config-edit.mjs edits one key line-wise (comments and order kept), broker.* keys are checked against scripts/broker/config-schema.mjs and the edited text is read back through parseYaml and normalizeBroker before it is written. Orient's conformance notice now names the verb. Tests: scripts/config-edit.test.mjs 11 passed.

## History
- [2026-11-02 19:25] (created) feature — t config: set a project's .ai/config.yml key (e.g. broker.affected.conformance) through a verb, with the broker config reader validating it;
- [2026-11-02 19:25] (comment) seen again in claude-kit: t config: set a project's .ai/config.yml key (e.g. broker.affected.conformance) through a verb, with the broker config reader validating it; today no verb edits config.yml, so an orient notice such as 'broker.affected.conformance is unset' has no sanctioned fix (dirt-empire DE-T285: conformance: car
- [2026-11-02 19:25] (asked again) 2026-11-02 — cap:feature:t-config-set-a-project-s-ai-config-yml-key-e-g-b
- [2026-11-02 22:51] (status) todo → review
- [2026-11-02 22:51] (landed) 5882693 t config get|set edits one .ai/config.yml key with broker keys checked against the reader (config-edit 11 passed, t-verb
