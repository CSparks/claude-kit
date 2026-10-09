// deck-config.mjs — where deck-deploy gets its targets and games (KIT-T397).
//
//   readTarget()        -> { host, user, key }  from ~/.claude/steamdeck.json (machine-specific)
//   parseDeckBlock(txt) -> game | null          the `deck:` block of a project's .ai/config.yml
//   discoverGames()     -> { <project>: game }  every registered project that carries a `deck:` block
//
// A game is { repo, name, bin, cargo: [...], assets?, toolchain?, env: {} }. The block is read
// line-wise (no yaml dep), like the rest of the kit's config readers:
//   deck:
//     name: Shown In Steam
//     bin: binary-name
//     cargo: [-p, crate, --bin, binary-name]
//     assets: crates/crate/assets
//     toolchain: stable
//     env:
//       BUILD_VAR: value, commas allowed

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverProjects } from "./survey.mjs";

export const TARGET_PATH = join(homedir(), ".claude", "steamdeck.json");

export function readTarget() {
  const t = JSON.parse(readFileSync(TARGET_PATH, "utf8"));
  return { host: t.host, user: t.user ?? "deck", key: (t.key ?? "~/.ssh/steamdeck").replace(/^~/, homedir()) };
}

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

export function parseDeckBlock(text) {
  const m = text.replace(/\r\n/g, "\n").match(/^deck:[ \t]*\n((?:(?:[ \t]+.*)?\n?)*)/m);
  if (!m) return null;
  const game = { env: {} };
  let inEnv = false;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^( +)([A-Za-z_][\w]*):[ \t]*(.*?)[ \t]*$/);
    if (!kv) continue;
    const [, indent, key, raw] = kv;
    if (inEnv && indent.length > 2) { game.env[key] = unquote(raw); continue; }
    inEnv = key === "env" && raw === "";
    if (inEnv) continue;
    const list = raw.match(/^\[(.*)\]$/);
    game[key] = list ? list[1].split(",").map(unquote).filter(Boolean) : unquote(raw);
  }
  return game.bin && game.cargo ? game : null;
}

export function discoverGames() {
  const games = {};
  for (const [name, { repo, notebook }] of Object.entries(discoverProjects().projects)) {
    if (!repo) continue;
    let text;
    try { text = readFileSync(join(notebook, "config.yml"), "utf8"); } catch { continue; }
    const game = parseDeckBlock(text);
    if (game) games[name] = { ...game, repo, name: game.name ?? name };
  }
  return games;
}
