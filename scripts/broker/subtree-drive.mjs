// subtree-drive.mjs — a second process for the submodule-tree tests (subtree.test.mjs). NOT a test.
//   node subtree-drive.mjs lane <laneName|root> <cfgFile> [--commit]   one queue pass in that lane; prints `processed=N queued=M`
//   node subtree-drive.mjs crash <cfgFile> <sha>                        take the root lane's tree, detach it at <sha>, die without releasing

import { readFileSync } from 'node:fs';
import { normalizeBroker, repoByName, withLane } from './config.mjs';
import { git } from './git.mjs';
import { processOnce } from './queue.mjs';
import { listQueue } from './result.mjs';
import { takeSubtrees } from './subtree.mjs';
import { join } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
const load = (file) => { const { root, broker } = JSON.parse(readFileSync(file, 'utf8')); return normalizeBroker(root, broker); };

if (mode === 'lane') {
  const [lane, file, ...flags] = args;
  const cfg = withLane(load(file), lane === 'root' ? null : lane);
  if (flags.includes('--commit')) git(['commit', '--allow-empty', '-q', '-m', 'mid-job'], join(cfg.root, 'rapid-game'));
  const { processed } = processOnce(cfg);
  console.log(`processed=${processed.length} queued=${listQueue(cfg).length}`);
} else if (mode === 'crash') {
  const [file, sha] = args;
  const cfg = withLane(load(file), null);
  const got = takeSubtrees(cfg, [repoByName(cfg, 'rapid-game')], 'j-dead');
  if (!got.ok) throw new Error(got.reason);
  git(['checkout', '-q', '--detach', sha], join(cfg.root, 'rapid-game'));
  process.exit(0);
}
