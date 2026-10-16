// subtree-drive.mjs — a second process for the submodule-tree tests (subtree.test.mjs). NOT a test.
//   node subtree-drive.mjs lane <laneName|root> <cfgFile> [--commit]   one queue pass in that lane; prints `processed=N queued=M`
//   node subtree-drive.mjs crash <cfgFile> <sha>                        take the root lane's tree, detach it at <sha>, die without releasing
//   node subtree-drive.mjs hold <cfgFile> <lane>                        take <lane>'s own tree, start a long detached command recorded in its children.json, print `child=<pid>`, die without releasing

import { spawn } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { brokerPaths, normalizeBroker, repoByName, withLane } from './config.mjs';
import { setChildRegistry, trackChild } from './children.mjs';
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
} else if (mode === 'hold') {
  const [file, lane] = args;
  const cfg = withLane(load(file), lane);
  const home = brokerPaths(cfg).home;
  setChildRegistry(join(home, 'children.json'));
  const got = takeSubtrees(cfg, [repoByName(cfg, lane)], 'j-held');
  if (!got.ok) throw new Error(got.reason);
  const logPath = join(brokerPaths(cfg).logs, 'j-held-0.log');
  const marker = `${logPath}.exit`;
  const fd = openSync(logPath, 'w');
  const child = spawn(process.execPath, [join(import.meta.dirname, 'run-child.mjs'), marker, 'node -e "setTimeout(() => {}, 120000)"'], { cwd: home, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
  child.unref();
  closeSync(fd);
  trackChild({ pid: child.pid, marker, logPath, cmd: 'git push (pre-push gate)' });
  console.log(`child=${child.pid}`);
  process.exit(0);
} else if (mode === 'crash') {
  const [file, sha] = args;
  const cfg = withLane(load(file), null);
  const got = takeSubtrees(cfg, [repoByName(cfg, 'rapid-game')], 'j-dead');
  if (!got.ok) throw new Error(got.reason);
  git(['checkout', '-q', '--detach', sha], join(cfg.root, 'rapid-game'));
  process.exit(0);
}
