#!/usr/bin/env node
// deck-config.test.mjs — the `deck:` block parser deck-deploy relies on (KIT-T397).

import assert from "node:assert/strict";
import { parseDeckBlock, unsafeField } from "./deck-config.mjs";

const CONFIG = `uat:
  default: required

# Steam Deck preview builds (deck-deploy, KIT-T397).
deck:
  name: Stiletto 2349
  bin: stiletto
  cargo: [--bin, stiletto]
  assets: assets
  toolchain: stable
  env:
    STILETTO_ALLOW_GENERATED_TEXTURES: private Steam Deck preview build, not a public release (ST-D034)

ids:
  key: ST
`;

const game = parseDeckBlock(CONFIG);
assert.deepEqual(game, {
  name: "Stiletto 2349",
  bin: "stiletto",
  cargo: ["--bin", "stiletto"],
  assets: "assets",
  toolchain: "stable",
  env: { STILETTO_ALLOW_GENERATED_TEXTURES: "private Steam Deck preview build, not a public release (ST-D034)" },
});

// CRLF configs parse the same; keys after env return to the game.
const crlf = parseDeckBlock("deck:\r\n  env:\r\n    A: \"1\"\r\n  bin: x\r\n  cargo: [-p, x, --bin, x]\r\n");
assert.deepEqual(crlf, { env: { A: "1" }, bin: "x", cargo: ["-p", "x", "--bin", "x"] });

// No block, or a block without bin/cargo, is not a game.
assert.equal(parseDeckBlock("ids:\n  key: X\n"), null);
assert.equal(parseDeckBlock("deck:\n  name: Half Done\n"), null);

// Fields spliced unquoted into the deploy script must be plain tokens.
assert.equal(unsafeField("stiletto-2349", game), null);
assert.match(unsafeField("x", { ...game, bin: "x; rm -rf ~" }), /^bin/);
assert.match(unsafeField("x", { ...game, toolchain: "$(id)" }), /^toolchain/);
assert.match(unsafeField("a b", game), /^project name/);
assert.match(unsafeField("x", { ...game, env: { "A=1;id;B": "v" } }), /^env key/);
for (const key of ["RUSTC_WRAPPER", "LD_PRELOAD", "PATH", "CARGO_BUILD_RUSTC", "BASH_ENV"]) {
  assert.match(unsafeField("x", { ...game, env: { [key]: "/tmp/evil" } }), /^reserved env key/, key);
}

console.log("deck-config: all assertions passed");
