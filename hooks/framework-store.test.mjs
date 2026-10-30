#!/usr/bin/env node
// A session in a framework's submodule checkout resolves to the framework's store (KIT-T738): marblequest/rapid-game has no
// `.ai/config.yml`, so `t decide` there took the game's MAR key. Controls: an unregistered submodule, a submodule with a
// store of its own, a git worktree, a plain nested repo and the game's own directories keep the nearest store.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const base = mkdtempSync(join(tmpdir(), 'kit-fwstore-'));
const store = (dir) => { mkdirSync(join(dir, '.ai'), { recursive: true }); writeFileSync(join(dir, '.ai', 'config.yml'), 'ids:\n  key: X\n'); };
const checkout = (dir, gitdir) => { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, '.git'), `gitdir: ${gitdir}\n`); };

const game = join(base, 'game');
const framework = join(base, 'framework-home', 'rapid-game');
store(game);
store(framework);
checkout(join(game, 'rapid-game'), '../.git/modules/rapid-game');
mkdirSync(join(game, 'rapid-game', 'rust', 'engine'), { recursive: true });
mkdirSync(join(game, 'rapid-game', '.ai', 'decisions'), { recursive: true });
checkout(join(game, 'other-lib'), '../.git/modules/other-lib');
checkout(join(game, 'rapid-game-wt'), '/repo/.git/worktrees/rapid-game-wt');
mkdirSync(join(game, 'nested', '.git'), { recursive: true });
const own = join(game, 'sub-with-store');
checkout(own, '../.git/modules/sub-with-store');
store(own);

const registry = join(base, 'registry.json');
writeFileSync(registry, JSON.stringify({ projects: { game, 'rapid-game': framework, 'sub-with-store': own }, excluded: [] }));
process.env.CLAUDE_KIT_REGISTRY = registry;

const { resolveStoreRoot } = await import('./lib/unbounded.mjs');
const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

ok('the submodule root resolves to the framework store, not the game', same(resolveStoreRoot(join(game, 'rapid-game')), framework), resolveStoreRoot(join(game, 'rapid-game')));
ok('a directory deep inside the submodule does too', same(resolveStoreRoot(join(game, 'rapid-game', 'rust', 'engine')), framework));
ok('a stray .ai without a config.yml inside the submodule does not make it a store', same(resolveStoreRoot(join(game, 'rapid-game', '.ai', 'decisions')), framework));

ok('control: the game itself keeps its store', same(resolveStoreRoot(game), game));
ok('control: an unregistered submodule keeps the game store', same(resolveStoreRoot(join(game, 'other-lib')), game));
ok('control: a worktree named like a project keeps the game store', same(resolveStoreRoot(join(game, 'rapid-game-wt')), game));
ok('control: a plain nested repo keeps the game store', same(resolveStoreRoot(join(game, 'nested')), game));
ok('control: a submodule with a store of its own keeps it', same(resolveStoreRoot(own), own));
ok('control: the framework checkout that owns the store keeps it', same(resolveStoreRoot(framework), framework));

console.log(`\nframework-store: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
