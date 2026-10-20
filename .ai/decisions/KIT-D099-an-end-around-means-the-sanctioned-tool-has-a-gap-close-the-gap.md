---
id: KIT-D099
title: An end-around means the sanctioned tool has a gap; close the gap first, then enforce
summary: when an agent goes around q, t, cap or the broker, the kit adds the missing capability to that tool so the bypass has no reason to exist, then a hook blocks the bypass and names the verb
date: 2026-10-19
supersedes: 
source: Chris 2026-10-19/20 (KIT-T592 note 1 and the coordinator's relay)
---


**Decision:** Every time an agent reaches past q, t, cap or the broker, the kit files and fixes the gap in the sanctioned path before it adds enforcement.
- Search: q answers what ripgrep answered. `q code --dir <path>` covers logs, build output and gitignored files; `--project <prefix>` reaches sibling checkouts; grep-habit flags (`-n -r -H`) are accepted; `**/` globs work; an empty answer names a framework submodule that was never searched.
- Work store: t covers every correction a hand write was used for (`t session --fix/--drop`, `t revise`, `t triage`, `t new --file` with a whole-ticket draft, `t move`).
- Tree: the broker covers deletes of untracked leftovers (`broker.mjs clean`) and builds with bytecode writing off; patch workers get a Write tool confined to the temp dir.
- Enforcement then names the verb: query-gate also judges the Grep tool, store-shell-gate blocks shell writes of `.ai`, tree-delete-gate blocks `rm` in a daemon-owned checkout, python-stdin-gate blocks stdin python on the Windows Store stub.

**Why:** Chris 2026-10-19: end-arounds must never be necessary; an agent reaching past a kit tool is avoiding a problem, not solving it. A block with no sanctioned route strands the agent and teaches it to hide the bypass. Mined from real usage: 3,461 greps against 2,107 q calls in 14 days in one project (most were filters over saved test output), 107 maintenance gaps from one cause, and the bike agent's three self-reported bypasses.

**Rejected:**
- Enforcement first: blocks without a route push agents to the next workaround (the Grep tool after a blocked bash grep).
- Reminding agents in briefs: the briefs already said "search with q, never grep" and the agents went around it.
