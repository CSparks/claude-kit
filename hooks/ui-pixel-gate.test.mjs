#!/usr/bin/env node
// ui-pixel-gate.test.mjs — game UI code in a rapid-game repo may not size UI with a pixel literal;
// the framework itself, other languages, other repos and the documented exclusions pass.
// Run: node hooks/ui-pixel-gate.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uiPixelViolation } from './lib/ui-pixel-gate.mjs';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const game = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-uipx-game-')));
const plain = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-uipx-plain-')));
for (const root of [game, plain]) execFileSync('git', ['init', '-q'], { cwd: root });
mkdirSync(join(game, 'rapid-game'), { recursive: true });
mkdirSync(join(game, 'crates', 'hud'), { recursive: true });
const run = (root, file, content) => spawnSync(process.execPath, [HOOK], { cwd: root, input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file, content } }), encoding: 'utf8' });
const PX = 'fn hud() {\n    let w = Val::Px(24.0);\n}\n';
const FRACTION = 'fn hud() {\n    let w = Val::Percent(4.0);\n}\n';

try {
  const hud = join(game, 'crates', 'hud', 'speed.rs');
  check('finds the literal and its line', uiPixelViolation(hud, PX, game)?.line === 2);
  check('blocks Val::Px(24.0) in game code', run(game, hud, PX).status === 2);
  check('the message names the framework route', /rg-ui/.test(run(game, hud, PX).stderr) && /ui-pixel-literal/.test(run(game, hud, PX).stderr));
  check('allows a fractional size', run(game, hud, FRACTION).status === 0);
  check('allows the framework itself', run(game, join(game, 'rapid-game', 'rust', 'rg-ui', 'a.rs'), PX).status === 0);
  check('allows a comment mentioning it', uiPixelViolation(hud, '// was Val::Px(24.0)\n', game) === null);
  check('allows other languages', uiPixelViolation(join(game, 'a.ts'), PX, game) === null);
  check('allows a repo without the framework', run(plain, join(plain, 'src', 'hud.rs'), PX).status === 0);
  writeFileSync(join(game, '.claude-kit-ignore.yaml'), 'ui-pixel-literal:\n  - "crates/hud/**"\n');
  check('the documented exclusion lifts it', run(game, hud, PX).status === 0);
} finally {
  rmSync(game, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
