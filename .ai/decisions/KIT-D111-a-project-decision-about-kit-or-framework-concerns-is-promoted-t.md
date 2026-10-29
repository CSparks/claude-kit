---
id: KIT-D111
title: A project decision about kit or framework concerns is promoted to a KIT or RG decision; orient flags it until it is
summary: Decisions about the broker, tests, hooks, agents or shared crates settled in one project's store do not reach the next project. Orient lists a project's unpromoted kit-or-framework decisions; promoting means a KIT or RG decision that cites the project id, or a `promoted:` line in the project decision.
date: 2026-10-29
supersedes: 
source: Chris 2026-10-29: 'this pattern was established with Stiletto and needs to be enforced elsewhere ... WHY THE FUCK doesn't this pattern transfer over?'; KIT-D110, KIT-T690
---


**Decision:**
1. A project decision whose title or summary touches the broker, test tiering, hooks, agents, dispatch, orient, shared crates or the framework is a kit or framework decision wearing a project id.
2. It is promoted: a KIT decision (kit concerns) or an RG decision (framework concerns) that cites the project id in its source, or a `promoted: KIT-D### | RG-D###` line in the project decision's frontmatter.
3. Orient prints the project's unpromoted decisions of that kind (count and the newest few) until each is promoted or marked `promoted: none (<why>)`.
4. `node scripts/decision-promotion.mjs --root <project>` lists every unpromoted decision of a store; a sweep is run when a project is adopted and when a decision is flagged.

**Why:** Stiletto settled the test tiering on 2026-10-21 (ST-D254, ST-D255); dirt-empire ran full suites per landing a week later because nothing carried the decision across.

**Rejected:** relying on agents to search other projects' stores; copying decisions by hand into each project.
