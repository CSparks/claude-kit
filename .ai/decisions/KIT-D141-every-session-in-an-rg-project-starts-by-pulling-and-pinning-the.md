---
id: KIT-D141
title: Every session in an RG project starts by pulling and pinning the latest framework; conflicts are raised to the maintainer
summary: All game projects on rapid-game work from its latest main; sessions pull and pin first, merge any local changes, resolve conflicts as normal, and always raise a conflict or breaking change to the maintainer
date: 2026-11-08
supersedes: 
source: conversation 2026-11-08 (Chris)
---


**Maintainer:** "Every game project working with RG needs to pull the latest and merge any uncommitted changes (of which there shouldn't be any, because the process should always be pull first before making changes). If another project is working on RG at the same time and pushes since last pull, it's typical merge conflict resolution stuff, but absolutely RAISE IT TO MY ATTENTION." "ANY session started in an RG project should begin with pulling and pinning the latest." "I would rather deal with breaking changes, which an LLM such as yourself are really good at handling." "There are like 5 ongoing projects using RG and they all need to be working from the latest. This is how the framework matures."

**Decision:** Every session started in a project that uses rapid-game begins by pulling the framework's latest main and pinning it, before any other change. Any uncommitted framework change is merged onto the pulled latest. A conflict with another project's push since the last pull is resolved as ordinary merge work and RAISED to the maintainer. Staying on an old pin to dodge a breaking change is wrong: the project absorbs the break and adapts. All RG projects (about five) track the latest.

**Why:** The framework matures only if every consumer runs on its latest; stale pins fork the projects from it. Rejected: pinning to a known-good old sha to avoid breaking changes.

**Assistant-added:** Enforcement belongs in the SessionStart hook (pull + pin + report the delta and any conflict); ticketed as a kit feature.

## Notes
Landed in user-config/CLAUDE.global.md GIT WORKFLOW. No project template or orient text names the framework pin. Enforcement ticketed as KIT-T891 (extends KIT-T870, KIT-T381); hook not built.
