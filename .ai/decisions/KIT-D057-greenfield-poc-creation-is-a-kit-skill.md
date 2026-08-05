---
id: KIT-D057
title: greenfield POC creation is a kit skill at the user level
date: 2026-08-06
supersedes:
source: conversation 2026-08-06 ("Creating a green field POC template needs to be a Claude Kit skill at the user level, not at the structural level.")
---

**Decision:** The greenfield-POC flow is a user-level kit skill (`skills/new-poc/`)
— the maintainer invokes `/new-poc` anywhere and Claude drives the whole flow:
generate from the rapid-game template, verify the ST-D011 bare-`cargo run` contract,
create the CSparks remote, offer kit adoption. The structural machinery (template +
generator script) STAYS in the framework repo (`CSparks/rapid-game`, ST-T122) — the
kit skill is the door, not the machine.

**Why:** The template buried in a framework repo requires remembering where the
script lives; a skill is discoverable at the user level on every machine the kit
bootstraps. Rejected: moving the template itself into claude-kit — the kit is
cross-project workflow tooling, and a Bevy/rg-prelude game template is framework
domain that must version with the framework.
