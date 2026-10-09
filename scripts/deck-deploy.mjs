#!/usr/bin/env node
// deck-deploy — build Rust/Bevy games as native Linux binaries in WSL and push them
// to a Steam Deck over SSH; the first push adds each game to the Steam library.
// Games live in ~/.claude/deck-games.json (machine-specific); `deck-deploy --help` shows
// the schema. Needs rustup + Bevy's Linux dev libraries in WSL, and sshd on the Deck.

import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = join(homedir(), ".claude", "deck-games.json");
const DEFAULT_INTERVAL_SEC = 60;
const MS_PER_SEC = 1000;
const ID_COLUMN = 16;

const USAGE = `usage:
  deck-deploy [--no-build] <game-id...|all>   build + push now
  deck-deploy watch [--interval <sec>]        redeploy a game whenever its git HEAD moves
  deck-deploy list                            show configured games

${CONFIG_PATH}:
  { "host": "192.168.1.107", "user": "deck", "key": "~/.ssh/steamdeck",
    "games": { "<id>": { "repo": "D:/dev/x", "name": "Shown In Steam",
                         "cargo": ["--bin", "x"], "bin": "x", "assets": "assets",
                         "env": { "BUILD_VAR": "value" }, "toolchain": "stable" } } }
  (toolchain is optional and overrides the repo's rust-toolchain.toml)

On the Deck each game lands in ~/Games/<id>/: the binary, assets/, launch.sh
(sets BEVY_ASSET_ROOT, logs to last-run.log) and <id>.desktop (the Steam shortcut).`;

function loadConfig() {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  cfg.user ??= "deck";
  cfg.key = (cfg.key ?? "~/.ssh/steamdeck").replace(/^~/, homedir());
  return cfg;
}

const toWsl = (winPath) =>
  winPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);

const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function deployScript(cfg, id, game, build) {
  const remote = `/home/${cfg.user}/Games/${id}`;
  const target = `$HOME/deck-target/${id}`;
  const ssh = `ssh -i ~/.ssh/deck-deploy-key -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new`;
  const dest = `${cfg.user}@${cfg.host}`;
  const launch = [
    "#!/bin/sh",
    'cd "$(dirname "$(readlink -f "$0")")"',
    'export BEVY_ASSET_ROOT="$PWD"',
    `exec ./${game.bin} "$@" >last-run.log 2>&1`,
  ].join("\n");
  const desktop = [
    "[Desktop Entry]", "Type=Application", `Name=${game.name}`,
    `Exec=${remote}/launch.sh`, `Path=${remote}`, "Terminal=false",
  ].join("\n");
  return [
    "set -euo pipefail",
    ". ~/.cargo/env",
    `install -D -m600 ${sq(toWsl(cfg.key))} ~/.ssh/deck-deploy-key`,
    `cd ${sq(toWsl(game.repo))}`,
    ...Object.entries(game.env ?? {}).map(([k, v]) => `export ${k}=${sq(v)}`),
    build ? `CARGO_TARGET_DIR=${target} cargo ${game.toolchain ? `+${game.toolchain} ` : ""}build --release --locked ${game.cargo.map(sq).join(" ")}` : "",
    `stage=$(mktemp -d)`,
    `cp ${target}/release/${game.bin} "$stage/"`,
    `printf '%s\\n' ${sq(launch)} > "$stage/launch.sh"`,
    `printf '%s\\n' ${sq(desktop)} > "$stage/${id}.desktop"`,
    `chmod +x "$stage/launch.sh" "$stage/${id}.desktop"`,
    `${ssh} -n ${dest} mkdir -p ${remote}`,
    `rsync -az -e ${sq(ssh)} "$stage/" ${dest}:${remote}/`,
    game.assets ? `rsync -az --delete -e ${sq(ssh)} ${sq(game.assets + "/")} ${dest}:${remote}/assets/` : "",
    `rm -rf "$stage"`,
    `${ssh} -n ${dest} ${sq(`cd ${remote} && if [ ! -e .in-steam ]; then steamos-add-to-steam ${id}.desktop && touch .in-steam && echo "added to Steam library"; fi`)}`,
  ].filter(Boolean).join("\n");
}

function deploy(cfg, id, build) {
  const game = cfg.games[id];
  if (!game) throw new Error(`unknown game '${id}' — see deck-deploy list`);
  console.log(`[deck-deploy] ${id}: ${build ? "build + " : ""}push → ${cfg.host}`);
  const r = spawnSync("wsl", ["-e", "bash", "-s"], {
    input: deployScript(cfg, id, game, build), stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`[deck-deploy] ${id}: ${r.status === 0 ? "deployed" : `FAILED (exit ${r.status})`}`);
  return r.status === 0;
}

const head = (repo) =>
  execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

async function watch(cfg, intervalSec) {
  const seen = Object.fromEntries(Object.entries(cfg.games).map(([id, g]) => [id, head(g.repo)]));
  console.log(`[deck-deploy] watching ${Object.keys(seen).join(", ")} every ${intervalSec}s`);
  for (;;) {
    await new Promise((r) => setTimeout(r, intervalSec * MS_PER_SEC));
    for (const [id, g] of Object.entries(cfg.games)) {
      const now = head(g.repo);
      if (now !== seen[id] && deploy(cfg, id, true)) seen[id] = now;
    }
  }
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const cfg = loadConfig();
if (args[0] === "list") {
  for (const [id, g] of Object.entries(cfg.games)) console.log(`${id.padEnd(ID_COLUMN)} ${g.name}  (${g.repo})`);
} else if (args[0] === "watch") {
  const i = args.indexOf("--interval");
  await watch(cfg, i >= 0 ? Number(args[i + 1]) : DEFAULT_INTERVAL_SEC);
} else {
  const build = !args.includes("--no-build");
  let ids = args.filter((a) => !a.startsWith("--"));
  if (ids.length === 0) { console.error(USAGE); process.exit(2); }
  if (ids.includes("all")) ids = Object.keys(cfg.games);
  const failed = ids.filter((id) => !deploy(cfg, id, build));
  process.exit(failed.length ? 1 : 0);
}
