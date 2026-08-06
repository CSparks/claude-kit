# SESSION HANDOFF — claude-kit

Updated: 2026-08-06 ~11:15 -0500 | Branch: main (89002d9 + this session's commit) | Active: ST-T138 sweep agent in flight

## Current state — comment contract + effort ladder landed (KIT-T205/T206, both done)
- **KIT-T205 / KIT-D059** — `user-config/CLAUDE.global.md` § SELF-COMMENTING CODE rewritten:
  doc comments = what it is + how to use it; inline = only a why code can't show; BANNED:
  dev history, quoted conversations/maintainer remarks (attribution, swearing), ticket
  archaeology; persistent rationale ≤ a bare ticket id; **fix on sight**. Composed
  `~/.claude/CLAUDE.md` rebuilt via `node bootstrap.mjs`. Trigger: stiletto lamp.rs shipped a
  28-line module doc quoting Chris verbatim.
- **KIT-T206 / KIT-D060** — "all agents spun up with Opus 5 need to be on lower effort"
  (Chris, mid-turn): `dispatch.tiers.standard` → opus/**low** (kit, stiletto, inv4d3rs
  configs); deep's opus FALLBACK documented at medium; all 7 opus-pinned kit agents now pin
  `effort: low` in frontmatter. jollys-vinyl still pins sonnet/medium (KIT-D043 drift) —
  capped 1606, NOT patched (may be deliberate).
- **KIT-T207** (todo, backlog) — pre-write gate check for backstory comments.
- Exemplar: stiletto lamp.rs cleaned, commit **ac1ad0d** pushed; `cargo test -p
  stiletto-game3d lamp` = 10 passed 0 failed.

## In flight — ST-T138 sweep agent (refactorer, opus/low)
Repo-wide backstory-comment sweep of stiletto (88 grep hits `Chris|fuck`, ~46 files).
Worktree-isolated at `.claude/worktrees/st-t138-sweep`, branch `st-t138-comment-sweep`,
because a LIVE stiletto session is committing to main (315e31f at 10:59 — it scooped 4 of my
in-progress lamp.rs edits; process-failure cap 1611). Agent merges to main only if the tree
is quiet, else pushes the branch and reports. Verify on collect: branch pushed, cargo test
--workspace green, ST-T138 → review.

## DONE this session — KIT-T208 → KIT-D061: version-tiered ladder SHIPPED
9 tiers (light/standard/careful/scoped/ui/asset/forensic/deep/max), FULL-id pins (aliases
drift — 'opus' retargeted 4.8→5 at v2.1.219), 7 agents re-pinned (asset lane = game-asset-artist
+ light-and-shadow on claude-fable-5/medium — supersedes KIT-T191), regression default =
forensic (fable/medium → fable/high → opus-5/xhigh fallback), effort re-derived on every
fallback. Propagated: kit + stiletto + inv4d3rs configs. Tests: dispatch-guard sweep now
enforces full-id pins + fable-asset-lane-only; model-tag expectations updated; npm test exit 0.
Evidence: research/model-routing-ladder-2026-08.md. KIT-T209 (todo): scaffold claude-opus-4-8
pinned agents for scoped/ui tiers — until then those tiers have no dispatch vehicle.

## Superseded context (pre-decision state, kept for audit)
### Was: KIT-T208 (doing): flesh out the dispatch tier ladder
Chris converged: version-tiered models (Opus 4.6 for straightforward fixes, 4.8 decent-not-great
at creative, Opus 5/Fable top), effort reserved for architecture/planning/persistent-bug analysis.
Grounded via claude-api skill: Opus 4.6/4.7/4.8/5 ALL $5/$25 (older Opus = behavior + separate
4.x rate-limit pool, NOT savings); real savings = Haiku $1/$5, Sonnet 5 $3/$15 (~30% tokenizer
inflation, KIT-D043 keeps it off coding); effort per version: 4.6 lacks xhigh, Haiku 4.5 has NO
effort param (API errors); docs confirm low/medium punch above weight on 5-gen models; Opus 4.1
retired 2026-08-05. KEY OPEN MECHANIC: Agent-tool `model` param takes aliases only — versioned
IDs likely pin only via agent frontmatter → tiers may need version-pinned agent definitions.

## ST-T138 COMPLETE at review — both halves merged, zero hits on main
Sweep a64b5fa + split 0a11d08 merged to stiletto main; post-merge 347 passed 0 failed;
repo-wide grep for maintainer-name/swearing: 0 hits. All 3 criteria ticked on evidence.
Worktrees/branches cleaned. Awaiting Chris's UAT (stiletto uat: required).

## STADIUM LIGHTING LANDED — stiletto 530f7ea (ST-T144 + ST-T145 at review)
First asset-lane dispatch (game-asset-artist @ fable/medium) delivered both tickets, merged
fast-forward, 357/0 tests, clippy clean. ST-T144 census: camera genuinely perspective; ALL
materials lit PBR (unlit theory disproven); THE cause = 0.000% spatial light gradient (zero
positional shadow casters — photometrically 2D). After: gradient 38.09%, shadow maps 2→6,
12 standing keys. lamp.rs now scale-parameterised (one builder: headlight + stadium head);
21 hot-reload tunables under "floodlight" in tuning.look.json. Residual levers ticketed
(zero specular + open-world gradient — new ST feature ticket). Chris UAT: run the game,
drive to spawn basecamp; ST-T138/T144/T145 all await his review.
KIT-T211 pre-write CRLF fix DONE (e94c8f0); KIT-T212 (test-hooks monolith) todo; light-and-
shadow agent registration gap capped 1908.

## ST-T138 sweep MERGED — a64b5fa on stiletto main (45 files, comment-only, +287/-386)
Quiet-window Monitor fired; merged clean, pushed; sweep worktree + branches removed. Sweep
evidence: 86/88 hits, tests identical before/after (557 pass / 1 pre-existing CRLF golden
failure → ST-T143 filed). IN FLIGHT: (1) post-merge cargo test --workspace (background,
main checkout); (2) mod_tests.rs SPLIT agent (Chris approved via questionnaire) — refactorer
in worktree st-t138-split, branch st-t138-modtests-split: splits the 625-line file under the
600 gate, clears the last 2 hits, merges on the same >10-min-quiet rule, ticks ST-T138's grep
criterion. ST-T138 stays review (uat: required): criterion "full cargo test green" left
UNTICKED honestly until ST-T143 (CRLF golden) is fixed.

## Next 3 steps
1. Collect the 3 agents; synthesize ladder; /decide questionnaire to Chris.
2. After decision: KIT-D061 + config edits + agent frontmatter pins as chosen.
3. Standing: KIT-Q001 (cap refuse-vs-warn) for next /decide; six bug tickets in review;
   morning inbox items 0817/0925 + .orphaned_at still uncommitted/untriaged.
