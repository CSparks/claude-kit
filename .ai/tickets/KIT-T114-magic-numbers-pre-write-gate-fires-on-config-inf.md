---
id: KIT-T114
title: MAGIC-NUMBERS PRE-WRITE GATE FIRES ON CONFIG / INFRA FILES — false positive. Hit 2026-06-12 writing a Docker/nginx/Let's-Encrypt deploy for client-rx-clinical (CRX-T004): the gate blocked `EXPOSE 3000` in a Dockerfile, and would equally block `listen 443 ssl;` / `listen 80;` in nginx conf, `rsa_key_size=4096` and `sleep 6h` in a bootstrap shell script, and port mappings in docker-compose.yml. These are conventional infrastructure constants (ports, RSA key sizes, renewal intervals) that are NOT extractable code constants — a Dockerfile `EXPOSE` takes a literal; nginx `listen` requires the literal port; compose `ports:` are literals. PROFILE of the false positive: the check is meaningful for application source (JS/TS) but not for config/infra file TYPES. FIX options: (a) default-exclude config file types from magic-numbers in the hook itself — YAML at minimum (it's used almost exclusively for config, Chris's call), and strongly consider Dockerfile, `*.conf`/nginx, and shell `.sh`; (b) keep the check restricted to the languages code-graph indexes (JS/TS) the way source-discovery greps are scoped (cf. KIT-T085); (c) ship a default `.claude-kit-ignore.yaml.example` that pre-excludes these infra globs. Worked around for now with a project-level `.claude-kit-ignore.yaml` in client-rx-clinical (magic-numbers excludes Dockerfile, docker-compose.yml, nginx/**, init-letsencrypt.sh, **/*.yaml, **/*.yml) — but that per-project patch shouldn't be necessary; the gate should not treat config/infra literals as magic numbers by default.
type: bug
status: review
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.699Z
updated: 2026-08-02T22:01:45Z
---

## Description
MAGIC-NUMBERS PRE-WRITE GATE FIRES ON CONFIG / INFRA FILES — false positive. Hit 2026-06-12 writing a Docker/nginx/Let's-Encrypt deploy for client-rx-clinical (CRX-T004): the gate blocked `EXPOSE 3000` in a Dockerfile, and would equally block `listen 443 ssl;` / `listen 80;` in nginx conf, `rsa_key_size=4096` and `sleep 6h` in a bootstrap shell script, and port mappings in docker-compose.yml. These are conventional infrastructure constants (ports, RSA key sizes, renewal intervals) that are NOT extractable code constants — a Dockerfile `EXPOSE` takes a literal; nginx `listen` requires the literal port; compose `ports:` are literals. PROFILE of the false positive: the check is meaningful for application source (JS/TS) but not for config/infra file TYPES. FIX options: (a) default-exclude config file types from magic-numbers in the hook itself — YAML at minimum (it's used almost exclusively for config, Chris's call), and strongly consider Dockerfile, `*.conf`/nginx, and shell `.sh`; (b) keep the check restricted to the languages code-graph indexes (JS/TS) the way source-discovery greps are scoped (cf. KIT-T085); (c) ship a default `.claude-kit-ignore.yaml.example` that pre-excludes these infra globs. Worked around for now with a project-level `.claude-kit-ignore.yaml` in client-rx-clinical (magic-numbers excludes Dockerfile, docker-compose.yml, nginx/**, init-letsencrypt.sh, **/*.yaml, **/*.yml) — but that per-project patch shouldn't be necessary; the gate should not treat config/infra literals as magic numbers by default.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [x] config/infra literals (nginx .conf, Dockerfile, PowerShell) no longer trip magic-numbers; real source still blocks

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->
### comment #1 [2026-08-02 22:01] @claude
Fixed, and the reported YAML case turned out to be already covered: pre-write line 184 exits early for the DATA family (json/yaml/yml/toml/ini/cfg), so docker-compose.yml and *.yaml never reached the check. The genuine gaps were the file classes DATA could not express: nginx `.conf` (conf was absent from the set), `Dockerfile` (no extension at all, so an extension-keyed test can never match it), and shell-family scripts with no native linter.
CHANGES: (1) conf/properties/env join DATA; (2) INFRA_BASENAME matches Dockerfile/Containerfile/Makefile/Procfile/.env plus suffixed forms like Dockerfile.prod; (3) a new SHELL_LIKE set (ps1/psm1/bat/cmd) is exempt from magic-numbers ONLY — deliberately narrower than NATIVE_LINTED, since those files have no native linter and must still get the rot-marker and dead-code checks.
Confirmed live this session: the gate blocked `-Depth 5` in a throwaway .ps1 while I was fixing KIT-T142, which is the exact false positive this ticket describes.
EVIDENCE: 6 new cases in hooks/exclusions.test.mjs covering nginx .conf, Dockerfile, Dockerfile.prod and a .ps1 literal (all now allowed), plus two guards proving the exemption did not over-broaden — a rot marker in a .ps1 still blocks, and a bare literal in .ts still blocks. npm test exit 0.

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
- [2026-08-02 22:01] (comment) criterion added: config/infra literals (nginx .conf, Dockerfile, PowerShell) no longer trip magic-numbers; real source still blocks
- [2026-08-02 22:01] (comment) ticked: config/infra literals (nginx .conf, Dockerfile, PowerShell) no longer trip magic-numbers; real source still blocks
- [2026-08-02 22:01] (comment) @claude: Fixed, and the reported YAML case turned out to be already covered: pre-write line 184 exits early for the DATA family ( (full comment #1 in ## Notes)
- [2026-08-02 22:01] (status) todo → review
