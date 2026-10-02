// patchkit.mjs — shared fixtures for the patch-queue tests (KIT-T276): a repo holding src.txt, a
// broker config over it, an envelope builder, and a snapshot of everything a check-only run
// must leave untouched.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { addOrigin, cleanup, commitOnMain, g, makeRepo, tempDir } from './testkit.mjs';

// Prints src.txt, so a test sees the content a patch produced.
export const SHOW = `node -e "process.stdout.write(require('fs').readFileSync('src.txt','utf8'))"`;

/** `*** edit src.txt` with one SEARCH/REPLACE block per [search, replace] pair. */
export const envelope = (...blocks) => `*** edit src.txt\n${blocks.map(([s, r]) => `<<<<<<< SEARCH\n${s}\n=======\n${r}\n>>>>>>> REPLACE`).join('\n')}\n`;

export function fixture() {
  const root = makeRepo(tempDir('patch-'));
  const bareDir = tempDir('patch-bare-');
  const bare = addOrigin(root, join(bareDir, 'origin.git'));
  commitOnMain(root, 'src.txt', 'alpha\nbeta\ngamma\n', 'add src');
  g(['push', 'origin', 'main'], root);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: ., main: main, remote: origin }\n');
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], verify_default: [SHOW] });
  return { root, cfg, bare, done: () => { cleanup(root); cleanup(bareDir); } };
}

export const snapshot = (root) => ({
  status: g(['status', '--porcelain', '-uall'], root),
  src: readFileSync(join(root, 'src.txt'), 'utf8'),
  files: g(['ls-files', '--others', '--cached', '--exclude-standard'], root),
});

export { commitOnMain, g };

/** origin's main sha. */
export const originSha = (bare, cwd) => g(['--git-dir', bare, 'rev-parse', 'main'], cwd);
