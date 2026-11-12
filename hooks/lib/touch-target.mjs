// A `touch` that changes only a modification time: no content is authored, so the source-write gate lets it pass
// for a file that exists (KIT-T1088). Strict allowlist, fail-closed like shell-copy-target.mjs.
//
//   touchTargets(argText, powershell?) -> { files, noCreate } | null
//     files     every operand: the paths touch may create or stamp
//     noCreate  -c or --no-create: a missing file is left missing
//     null      any token outside the allowlist: a glob, variable, substitution, unquoted backslash, an option
//               other than -a -m -c -d DATE -t STAMP -r REF (exact forms, -a -m -c clustered) and their long
//               forms --date --reference --no-create, a glued short value, a quoted option, no operand
//   touchLifted(found, cwd) -> boolean
//     the gate's verdict on a hit tagged `mtimeOnly`: lifted when the file exists, or -c creates nothing.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { toPath } from './shell-segments.mjs';
import { isOption, tokenize } from './shell-copy-target.mjs';

const FLAG_CLUSTER = /^-[amc]+$/;
const VALUE_SHORT = ['-d', '-t', '-r'];
const VALUE_LONG = ['--date', '--reference'];
const JOINED_LONG = /^--(?:date|reference)=(.+)$/;
const NO_CREATE_LONG = '--no-create';
const NO_CREATE_SHORT = 'c';

// The option's value is the next token, taken as a whole: a value that itself starts with a dash is refused.
function takesValue(token) {
  return VALUE_SHORT.includes(token.v) || VALUE_LONG.includes(token.v);
}

export function touchTargets(argText, powershell = false) {
  const { tokens, open } = tokenize(String(argText), powershell);
  if (open || tokens.some((t) => t.impure)) return null;
  const files = [];
  let noCreate = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isOption(t)) { files.push(t.v); continue; }
    if (t.quoted) return null;
    if (takesValue(t)) {
      const value = tokens[++i];
      if (!value || isOption(value)) return null;
    } else if (t.v === NO_CREATE_LONG || (FLAG_CLUSTER.test(t.v) && t.v.includes(NO_CREATE_SHORT))) {
      noCreate = true;
    } else if (!JOINED_LONG.test(t.v) && !FLAG_CLUSTER.test(t.v)) return null;
  }
  return files.length ? { files, noCreate } : null;
}

export function touchLifted(found, cwd) {
  if (!found.mtimeOnly) return false;
  return found.mtimeOnly.noCreate || existsSync(resolve(cwd, toPath(found.path)));
}
