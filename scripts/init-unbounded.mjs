#!/usr/bin/env node
// init-unbounded.mjs — create the UNBOUNDED catch-all store (KIT-T189).
//
//   node <kit>/scripts/init-unbounded.mjs [--key ABC]
//
// Sessions that start outside every repo (a home directory, a scratch dir) have no `.ai`
// above their cwd, so cap/t/q and the orientation + flush hooks used to no-op and whatever
// was found there was lost. This scaffolds ONE catch-all store with the standard layout, at
// `<dataRoot>/unbounded/.ai` (or wherever CLAUDE_KIT_UNBOUNDED_AI / the registry's
// `unbounded` points), from the same project template every adopted repo is seeded from.
//
// It also registers the store so the shared cache hydrates it — retrieval from `~` (q inbox,
// q fts, q topics) answers about it the way it answers about a repo.

import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedCentralDataDir, seedProjectKey } from './init-project.mjs';
import { unboundedAiDir, noStoreMessage, recordProject, recordUnbounded } from '../hooks/lib.mjs';

const NAME = 'unbounded';

function main() {
  const aiDir = unboundedAiDir();
  if (!aiDir) {
    process.stderr.write(`init-unbounded: ${noStoreMessage()}.\n`);
    return 1;
  }
  const root = dirname(aiDir);
  const existed = existsSync(aiDir);
  seedCentralDataDir(aiDir);
  seedProjectKey(aiDir, NAME);
  recordUnbounded(aiDir);
  recordProject(NAME, root);
  process.stdout.write(`${existed ? 'unbounded store already present' : 'unbounded store created'}: ${aiDir}\n`);
  process.stdout.write('next: cap topic <slug>, then cap "…" from anywhere with no .ai above it\n');
  return 0;
}

process.exit(main());
