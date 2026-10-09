#!/usr/bin/env node
// deck-config.test.mjs — the `deck:` block parser deck-deploy relies on (KIT-T397).

import assert from "node:assert/strict";
import { parseDeckBlock } from "./deck-config.mjs";

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

console.log("deck-config: all assertions passed");
