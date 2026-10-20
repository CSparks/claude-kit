// Which paths a shell delete command removes inside a checkout: the delete commands of a command
// line (rm, rmdir, del, Remove-Item), their targets resolved against the cwd (following `cd`), kept
// when they sit inside `root` and are not build output or .git.
//
//   treeDeleteTargets(command, root, cwd) -> absolute paths

import { isAbsolute, relative, resolve } from 'node:path';
import { segments, cdTarget, toPath } from './shell-segments.mjs';

const DELETE_CMD = /^(?:rm|rmdir|del|erase|unlink|remove-item|ri)$/i;
const BUILD_OUTPUT = new Set(['target', 'node_modules', 'dist', 'build']);

const within = (base, abs) => {
  const rel = relative(base, abs);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

export function treeDeleteTargets(command, root, cwd) {
  const hits = [];
  let here = cwd;
  for (const { text } of segments(command)) {
    const dir = cdTarget(text.trim());
    if (dir) { here = resolve(here, dir); continue; }
    const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
    if (!tok.length || !DELETE_CMD.test(tok[0].replace(/.*[\\/]/, ''))) continue;
    for (const a of tok.slice(1)) {
      if (a.startsWith('-')) continue;
      const abs = resolve(here, toPath(a));
      const rel = relative(root, abs);
      const top = rel.split(/[\\/]/)[0];
      if (within(root, abs) && !BUILD_OUTPUT.has(top) && top !== '.git') hits.push(abs);
    }
  }
  return hits;
}
