// linkedkit.mjs — helpers for the linked (superproject + submodule) landing tests: linked.test.mjs and
// linked-crash.test.mjs. NOT a test.
//
//   BOTH           -> a verify command that passes only when api.txt and rapid-game/api.txt agree
//   linked(t)      -> commits and pushes api v1 in both trees of a subkit fixture; returns env(consumer), the patch
//                     envelope that edits the submodule to v2 and the consumer file to `consumer`
//   names(cwd)     -> the sorted file names the HEAD commit touched

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { g } from './patchkit.mjs';

export const BOTH = 'node -e "const fs=require(\'fs\');process.exit(fs.readFileSync(\'api.txt\',\'utf8\').trim()===fs.readFileSync(\'rapid-game/api.txt\',\'utf8\').trim()?0:1)"';

export function linked(t) {
  writeFileSync(join(t.sub, 'api.txt'), 'v1\n');
  g(['add', 'api.txt'], t.sub);
  g(['commit', '-m', 'api v1'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  writeFileSync(join(t.root, 'api.txt'), 'v1\n');
  g(['add', 'api.txt', 'rapid-game'], t.root);
  g(['commit', '-m', 'consume api v1'], t.root);
  g(['push', 'origin', 'main'], t.root);
  return (consumer) => `*** edit rapid-game/api.txt\n<<<<<<< SEARCH\nv1\n=======\nv2\n>>>>>>> REPLACE\n*** edit api.txt\n<<<<<<< SEARCH\nv1\n=======\n${consumer}\n>>>>>>> REPLACE\n`;
}

export const names = (cwd) => g(['show', '--name-only', '--pretty=format:', 'HEAD'], cwd).split('\n').map((l) => l.trim()).filter(Boolean).sort();
