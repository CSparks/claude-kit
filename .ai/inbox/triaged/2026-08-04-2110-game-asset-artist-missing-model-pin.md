# game-asset-artist has no model pin — a dispatch ran on Fable

The T066/T067 devtools build (stiletto, 2026-08-04) reports its commits signed
"Co-Authored-By: Claude Fable 5 — the actual model on this dispatch" despite the
dispatch intending opus. KIT-T151 pinned `model: opus` on researcher, code-reviewer,
refactorer, test-author — `agents/game-asset-artist.md` apparently never got the pin,
so it inherits the main-thread model (fable today = ~288K tokens at fable pricing for
an opus-grade job).

Fix: add `model: opus` to game-asset-artist frontmatter; sweep ALL kit agents for
missing pins (any agent added after KIT-T151 is suspect); consider a kit CI check that
every agents/*.md carries an explicit model. Note the dispatch-ladder hook covers
UNPINNED types only when the caller omits model — a kit agent's own frontmatter is the
intended guarantee, so its absence is silent.
