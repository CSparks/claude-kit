// Which paths a shell delete command removes inside a checkout: the delete commands of a command
// line (rm, rmdir, del, Remove-Item), their targets resolved against the cwd (following `cd`), kept
// when they sit inside `root` and are not build output or .git. A path the shell would expand
// ($VAR, $(…), `…`, %VAR%, ~) is unknown, so it is never resolved against the checkout; a `cd` to
// one leaves the directory unknown for the relative paths that follow.
//
//   treeDeleteTargets(command, root, cwd) -> absolute paths

import { isAbsolute, relative, resolve } from 'node:path';
import { segments, cdTarget, toPath } from './shell-segments.mjs';

const DELETE_CMD = /^(?:rm|rmdir|del|erase|unlink|remove-item|ri)$/i;
const BUILD_OUTPUT = new Set(['target', 'node_modules', 'dist', 'build']);

const EXPANDS = /[$`]|%[^%\s]+%|^["']?~/;

// The directory after a `cd`: null while it cannot be known (an expanded path, or a relative step from an unknown one).
const moveTo = (here, dir) => (EXPANDS.test(dir) || (here === null && !isAbsolute(dir)) ? null : resolve(here ?? '', dir));

const within = (base, abs) => {
  const rel = relative(base, abs);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

export function treeDeleteTargets(command, root, cwd) {
  const hits = [];
  let here = cwd;
  for (const { text } of segments(command)) {
    const dir = cdTarget(text.trim());
    if (dir) { here = moveTo(here, dir); continue; }
    const tok = text.trim().match(/"[^"]*"|'[^']*'|\S+/g) || [];
    if (!tok.length || !DELETE_CMD.test(tok[0].replace(/.*[\\/]/, ''))) continue;
    for (const a of tok.slice(1)) {
      if (a.startsWith('-') || EXPANDS.test(a)) continue;
      const path = toPath(a);
      if (here === null && !isAbsolute(path)) continue;
      const abs = resolve(here ?? '', path);
      const rel = relative(root, abs);
      const top = rel.split(/[\\/]/)[0];
      if (within(root, abs) && !BUILD_OUTPUT.has(top) && top !== '.git') hits.push(abs);
    }
  }
  return hits;
}
