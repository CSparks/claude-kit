# Hooks library

Portable **Node** enforcement hooks — the layer that makes the workflow
non-skippable, installed globally by `bootstrap.sh` but **opt-in-aware** (each
exits immediately unless the repo has `.ai/`, so they never interfere with
unadopted projects).

The plugin wiring is dual-host. `hooks/hooks.json` launches every handler through
`compat-run.mjs`: Claude Code receives its original payloads and output unchanged;
Codex gets per-file `apply_patch` fanout and the structured output required by its
tool, compaction, subagent, and stop hooks. Codex sets `CLAUDE_PLUGIN_ROOT` for
compatibility, so the same committed commands resolve on both hosts.

## Why Node, not bash
OS-shell hook scripts aren't portable and broke in practice (Windows/MSYS +
Python path handling, and a `python - <<heredoc` bug that ate its own stdin and
silently disabled a check). Node runs the same on every machine. Each hook reads
the tool payload from stdin, decides, and exits (`exit 2` = block, `0` = allow).

## The hooks
| Event | Hook | Does |
| --- | --- | --- |
| `SessionStart` | orient + housekeeping | Inject the on-disk record (`.ai/` ROADMAP + DECISIONS + SESSION + recent commits + **in-flight delegated agents**) so a fresh/compacted session resumes cold; surface any due weekly reviews + project gaps. |
| `PreToolUse` (Edit\|Write) | pre-write | Code-quality gates on source; **doc files** get a broken-link check instead of magic-number/etc; license/meta + data files skip. |
| `PostToolUse` (Edit\|Write) | lint + jscpd + ingest-data | Language-aware linters (ruff/clippy/eslint/…) + copy-paste detection (advisory — never block). **ingest-data** incrementally syncs the SQLite cache for the edited `.ai` store immediately, so a same-turn query sees the change (KIT-T026; fail-open). |
| `PostToolUse` (Task\|Agent) + `SubagentStop` | agent-roster | Append each delegated subagent (task, scope, handle, status, its `model` — KIT-T179 — plus its `isolation` + `targetRoot` — which tree it lands in, KIT-T177) to the durable roster `.ai/agents.jsonl`, and mark its completion — so a clear/compact mid-delegation never orphans the work; orient replays it on resume (KIT-T014; fail-open, never blocks a delegation). A dispatch row arriving AFTER its own `SubagentStop` (synchronous delegations report in that order) keeps the terminal status instead of resurrecting the agent. |
| `PostToolUse` (`mcp__*context7*`) | context7-ledger | Append one JSONL row (`ts`, `tool`, library/query extract) per **metered** context7 call to `~/.claude/context7-ledger.jsonl`, so paid docs spend is answerable from disk (KIT-T182/KIT-D055). Deliberately **not** `.ai/`-gated — the quota is per-machine, so the ledger is too. Also warns (stderr, never blocks) when the library is already covered by a doc in `research/README.md`'s index. |
| `PreToolUse` (Bash\|PowerShell) | license-guard | Block `npm install` / `cargo add` of a GPL/LGPL/AGPL/unlicensed dependency (KIT-T022). Looks up the package license via the registry; fails open if offline. Escape: `[allow-license: reason]` or `CLAUDE_KIT_ALLOW_LICENSE=1`. Nudges to update `THIRD_PARTY_LICENSES` on permissive adds. |
| `PreToolUse` (Bash) | commit-gate | Block a `git commit` of code not tied to a ticket / plan-of-record (override `[no-log: reason]`). |
| `PreToolUse` + `PostToolUse` (Bash\|PowerShell), `SubagentStop`, `Stop` | progress | Publish the long build a session is running to `.ai/agents-progress.jsonl` — start writes the line, completion clears it, termination sweeps the rest (KIT-T178). Never gates; always exits 0. See **Subagent progress** below. |
| `PreToolUse` (Task\|Agent) | dispatch-guard | Gate the three dispatch shapes that burn money (KIT-T151/KIT-T176) — see **Dispatch checks** below. Blocks; fail-open; escapes are inline prompt tokens. |
| `PreToolUse` (Task\|Agent) | activity-tag | Put the MODEL on the delegation's activity line (KIT-T179): `general-purpose  [Opus 5] Build CRX-T024 …`. See **Model tags** below. Never gates — it rewrites `description` and nothing else. |
| `PreToolUse` (AskUserQuestion) | question-gate | Block a non-compliant questionnaire (KIT-T086): every question must mark its recommended option on the LABEL (prefix `(Recommended)`), and — single-select — list it FIRST. Catches the lived bug of putting the marker in the option DESCRIPTION (where it never renders). Agent-discipline rule — fires regardless of `.ai/` adoption; fail-open. |
| `PreCompact` | flush | Force a `.ai/SESSION.md` flush before context is lost. |
| `Stop` | housekeeping + flush + sync-data | Nag if a weekly review is overdue; **flush**'s SESSION-anchor ratchet nudges once when work landed this turn but `SESSION.md` wasn't touched (KIT-T014); **auto-commit + push `claude-kit-data`** when the centralized data repo is dirty (D-008), so a turn's `.ai/` edits persist without manual ceremony. |

**Tool resolution (`lib.nodeCli`)** runs node-ecosystem linters as `node <bin.js>` —
resolving project-local first, then a global install — so a `.cmd`-shimmed global on
Windows (which `execFileSync` can't spawn) works without ever invoking a shell.
`lint`/`jscpd` are advisory and intentionally **not** gated on `.ai/` (they run in any
repo, like `pre-write`); only the enforcement hooks no-op on unadopted repos.

## Dispatch checks (`dispatch-guard`)
A delegation's cost is decided at ONE choke point — the Agent/Task dispatch — so every
dispatch rule is enforced there. Each check is independent (own escape token, own
exclusion key) and every one is a **block**, per the halts-not-warnings contract; all three
fail open on a malformed payload or an unreadable file.

| Check-id | Blocks | Escape token |
| --- | --- | --- |
| `dispatch-ladder` | The **silent fable inherit** (KIT-T151): no `model` on the call, no `model:` pin in the agent's definition, and the session transcript's latest turn is fable. An explicit model — fable included — always passes; a chosen tier is a deliberate choice. | `[allow-fable: <reason>]` in the prompt, or `CLAUDE_KIT_ALLOW_FABLE=1` |
| `cold-worktree-build` | `isolation: "worktree"` into a repo with a root `Cargo.toml` when the brief never mentions `CARGO_TARGET_DIR` (KIT-T176). A fresh worktree has no `target/`, so the agent pays a **cold build of the whole dependency graph** — lived case 2026-08-04: a Bevy workspace sat 30+ min silent, rustc at 3.3 GB RSS, all billed. Fix in the BRIEF: point `CARGO_TARGET_DIR` at the main checkout's `target/`. | `[cold-build-ok: <reason>]` in the prompt |
| `shared-tree-dispatch` | A dispatch **without** worktree isolation while `.ai/agents.jsonl` (the roster `agent-roster` writes) holds an in-flight row younger than 2h **for the same working tree** (KIT-T176, tree-scoped by KIT-T177). One agent per working tree — two share one HEAD + index and pay to poll each other's half-written files; lived case 2026-08-03: a billed agent waited out a colleague's broken refactor, then built a throwaway scratch crate around it. A row is only counted when it is non-terminal, **not** `isolation: worktree`, and its recorded `targetRoot` is this dispatch's tree; rows older than 2h are treated as abandoned. A pre-KIT-T177 row carries neither field and counts — the conservative side of the halt. | `[shared-tree-ok: <reason>]` in the prompt |

## Model tags (`activity-tag` + `model-tag.mjs`, KIT-T179)
A delegation's model decides what it costs, and it was invisible everywhere the delegation was
watched — the native activity line reads `general-purpose  Build CRX-T024 admin foundation`,
with no tier in it, so a mis-tiered or silently-inherited dispatch looks exactly like a correct
one until the bill lands. `activity-tag` rewrites the line to
`general-purpose  [Opus 5] Build CRX-T024 admin foundation`, and the same tag rides the roster
into orient and the `shared-tree-dispatch` block message.

- **Resolution** (`model-tag.mjs`, the one implementation — `dispatch-guard` imports it):
  explicit `model` on the call → the agent definition's `model:` frontmatter pin → the session
  model from the transcript. Indeterminate resolves to `''` and NOTHING is tagged; a guessed
  tier would be worse than no tier.
- **Display names are a DATED lineup fact**, spelled in exactly one table (`LINEUP`): `opus` /
  `claude-opus-5*` → `Opus 5`, `fable` → `Fable 5`, `sonnet` → `Sonnet 5`, `haiku` /
  `claude-haiku-4-5*` → `Haiku 4.5`. An unknown value passes through **verbatim**, and the
  generation is part of every pattern on purpose — `claude-opus-4-1` must not read as "Opus 5".
  **When the lineup changes, edit that table** (KIT-D035/D042/D043 territory).
- **Mechanism**: `hookSpecificOutput.updatedInput` — "an object with the same shape as
  `tool_input`, replacing the tool's arguments before it runs" (verified against
  code.claude.com/docs/en/hooks §"PreToolUse decision control", 2026-08-05). It is a FULL
  replacement, so the hook spreads the original input.
- **It cannot weaken `dispatch-guard`**, which fires on the same event: `activity-tag` emits no
  `permissionDecision` at all, and omitting the field is documented as equivalent to `defer`.
- Idempotent (never stacks `[Opus 5] [Opus 5]`), leaves an author's own bracket prefix
  (`[CRX-T024] …`) intact, and `agent-roster` strips the tag back off before storing the task
  label so the roster keeps model and task in separate fields.

## Subagent progress (`progress`, KIT-T178)
A subagent running `cargo build` streams nothing: the tool call is one opaque block, and the
only way anyone answered "compiling or hung?" was tasklist/rustc forensics from the main
thread (three complaints in one day, 2026-08-04). `progress.mjs` makes it a file instead.

- **Store:** `.ai/agents-progress.jsonl`, append-only JSONL collapsed on read — the roster's
  shape (KIT-T014/KIT-D024), for the same reason: concurrent writers can't corrupt each
  other and one bad line can't poison the file. Machine-local live state, so it is
  **gitignored** — a "running" line from another machine would be a lie, not history.
- **Key:** the roster's `agent_id` wherever one exists, so a progress line joins the
  delegation that owns it. A subagent's Bash payload carries no handle, but its transcript is
  `…/subagents/agent-<AGENT_ID>.jsonl` and that id is byte-identical to the roster's.
- **Matcher:** per-ecosystem (`ECOSYSTEMS` in `progress-store.mjs`) — adding npm/gradle/bazel
  is one row there and nothing else. v1 ships cargo (`build|check|test|clippy`), the
  ecosystem whose cold builds produced the complaint.
- **Clearing** has three independent chances — PostToolUse, SubagentStop/Stop sweep, and a 2h
  staleness window in the reader — because a permanently-stuck "compiling" line is worse than
  no line at all.
- **Consumer:** orient's in-flight listing renders `— running: cargo test (6m)`, and shows a
  build whose dispatch row hasn't been written yet as `[running]`. An agent that is
  demonstrably compiling is no longer flagged `UNCOLLECTED`.

**Event coverage — VERIFIED, not assumed** (the KIT-T177 lesson). Measured 2026-08-04 from
inside a live delegated subagent on Windows:

| Question | Verdict | How |
| --- | --- | --- |
| `PreToolUse(Bash)` fires in a subagent session? | **yes** | `query-gate` blocked a grep issued by the subagent; 41 further `PreToolUse:Bash` events recorded on sidechain turns across 258 transcripts |
| `PostToolUse` fires in a subagent session? | **yes** | `lint.mjs` appended a `~/.claude/maintenance-gaps.log` row naming a file the subagent had just written |
| `PostToolUse(Bash)` specifically? | **yes** | `git-pull-hydrate` (registered on that matcher alone) hydrated the SQLite cache 3s after a subagent Bash call matching its pattern |
| Does a subagent SEE its own PostToolUse hook output? | **no** | the gap-log row proves the hook ran, yet no stderr reached the agent — which is why sidechain transcripts record zero `PostToolUse` events |

The last row is why this design writes a FILE rather than emitting a message: inside a
subagent, PostToolUse stderr goes nowhere. Residual: `Stop`/`SubagentStop` delivery is not
guaranteed for every dispatch shape (KIT-T177 found roster rows with no terminal event), which
is what the staleness window covers.

## Rules
- **Opt-in-aware:** first thing each hook does is `exit 0` unless `.ai/` (or a
  project ROADMAP) is present. Global install must never punish unadopted repos.
- **Fail-open on parse errors** — a malformed payload must not wedge the session.
- **Least surprise:** block only on hard violations; warn (stderr, exit 0) otherwise.
- Wired into `~/.claude/settings.json` via `user-config/settings.recommended.json`;
  installed/symlinked by `bootstrap.sh`.

## Exclusions — `.claude-kit-ignore.yaml` + in-source markers (KIT-T051)
Philosophy: **halts in anything but exclusions.** Every gate keeps its hard block by
default — the ONLY non-halt path is an explicit, documented exclusion. No check is
softened (magic numbers, `SELECT *`, file length, etc. all STAY blocks). The escape hatch
exists so a genuine false positive (or a generated tree the rule doesn't apply to) has an
obvious, committed way out. Every block/warn message ends with `excludeFooter(<check-id>)`,
which names the id and shows BOTH surfaces below. Both are **dependency-free** (tolerant
line-scan, no YAML dep) and **fail-open** (a malformed ignore file → no exclusions, never a
wedged write).

**1. Path globs — `.claude-kit-ignore.yaml` at the project root.** A map of `check-id →
[glob, ...]`; a `'*'` (alias `all`) key excludes from EVERY check. Globs are repo-root-
relative and support `**` (any depth), `*` (within a segment), `?`. Template:
`.claude-kit-ignore.yaml.example`.

```yaml
magic-numbers:
  - tools/asset-preview/**
  - "src/**/geometry/**"
file-length:
  - "src/generated/**"
"*":
  - vendor/**
```

**2. In-source markers** — exclude a code BLOCK or LINE in the file's own comments
(`//`, `#`, or `--` styles):

| Marker | Scope |
| --- | --- |
| `// claude-kit-ignore-file  <id\|all>` | the whole file |
| `// claude-kit-ignore-start <id\|all>` … `// claude-kit-ignore-end` | the lines between |
| `// claude-kit-ignore-line  <id\|all>` | the next line |
| `someCode();  // claude-kit-ignore <id\|all>` | that one line (trailing) |

**Check-ids** (named in every gate message, so you always know which key to use):

| Gate | Check-ids | Exclusion level |
| --- | --- | --- |
| `pre-write` | `todo-markers` · `dead-code` · `magic-numbers` · `select-star` · `sql-injection` · `file-length` · `broken-doc-links` | path glob **and** in-source markers (line/block for `magic-numbers`; whole-file for `file-length`) |
| `query-gate` | `store-grep` · `source-discovery` | path glob (on a path-ish command arg) |
| `jscpd` | `duplication` | path glob |
| `lint` | `lint` | path glob |
| `commit-gate` | `commit-log` | path glob (an excluded code path doesn't require a citation) |
| `license-guard` | `license-guard` | path glob (an excluded path skips the dep-name check for local/vendored deps) |
| `request-gate` | `request-capture` | repo-wide glob over `.ai/` disables the gate (like `capture.enabled: false`) |
| `dispatch-guard` | `dispatch-ladder` · `cold-worktree-build` · `shared-tree-dispatch` | path glob matched against the REPO ROOT (`- "**"` disables a check for the repo); prefer the inline prompt token for a one-off |

**lib helpers** (`hooks/lib.mjs`): `loadIgnoreConfig(root)` → `{ checkId: globs[] }`;
`pathExcluded(root, checkId, filePath)` → bool; `markerExcludedLines(source, checkId)` →
`{ wholeFile, lines:Set }`; `excludeFooter(checkId)` → the uniform footer string.

> Status: **fully ported to Node** — `lib`, `orient`, `commit-gate`, `flush`, `pre-write`,
> `lint`, `jscpd`, `housekeeping`. The hooks layer is Node-only; no bash hooks remain.
> Wired via `user-config/settings.recommended.json` + `bootstrap.sh`. Verified against
> mock payloads; the port fixes the bash bugs (const-skip, Windows backslash paths, the
> `python - <<heredoc` stdin bug that silently disabled lint/jscpd, and a gap-dedup key
> that never matched).
