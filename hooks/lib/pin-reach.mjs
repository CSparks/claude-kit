// pin-reach.mjs — whether a `git add` earlier in the same command may stage a submodule pointer (KIT-T1363, KIT-T1562).
//
//   addsMayReach(command, { root, shell, cwd }, pin) -> boolean
//     False when the command adds nothing, or when every add runs in the repo root (no `-C`, no cd, the shell's own directory
//     is the root) and every pathspec of it is a plain root-relative path that is not the pin, not inside it and not a parent
//     of it. True for any other add: an expansion, `..`, `./`, `.`, a glob, magic, an absolute or home path, a directory that
//     holds the pin, an add whose directory is not the root, or an add the parser cannot place. A pin the add may reach is
//     judged from the work tree (what `git commit -- <pin>` would take); any other pin is judged from the index.

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { addSpecs } from './commit-files.mjs';
import { gitCalls } from './git-calls.mjs';

const ADD_VERBS = ['add', 'stage'];
const PLAIN_PATH = /^[^\s:~\\$`*?[\]{}()<>|;&'"!^#]+$/;
const RELATIVE_STEPS = new Set(['.', '..']);

const components = (path) => String(path).replace(/\\/g, '/').split('/').filter(Boolean).map((c) => c.toLowerCase());
const startsWith = (whole, prefix) => prefix.every((c, i) => whole[i] === c);

function plainClearOfPin(spec, pinParts) {
  if (!PLAIN_PATH.test(spec) || spec.startsWith('/')) return false;
  const parts = components(spec);
  if (!parts.length || parts.some((c) => RELATIVE_STEPS.has(c))) return false;
  return !startsWith(pinParts, parts) && !startsWith(parts, pinParts);
}

// A directory as the file system names it: links and 8.3 short names resolved, case folded where the system ignores case.
function canonical(dir) {
  const real = realpathSync.native(resolve(dir));
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function addsRunInRoot(command, { root, shell, cwd }) {
  const calls = gitCalls(command, { shell, cwd }).filter((call) => ADD_VERBS.includes(call.sub));
  return calls.length > 0 && calls.every((call) => !call.explicitDir && canonical(call.dir) === canonical(root));
}

export function addsMayReach(command, ctx, pin) {
  try {
    const specs = addSpecs(command);
    if (!specs.length) return false;
    const pinParts = components(pin);
    return !addsRunInRoot(command, ctx) || specs.some((spec) => !plainClearOfPin(spec, pinParts));
  } catch {
    return true;
  }
}
