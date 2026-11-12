// Whether a `touch` runs where the source-write gate checks it exists (KIT-T1088, KIT-T1091).
//
//   touchPlaceKnown(parts, at, raw, start?) -> boolean
//     parts  the command's segments ({ text, after }); at the index of the touch; raw the whole command line
//     true   every segment up to the touch runs unconditionally (operator start, `;` or `&&`, never a pipe,
//            background or `||`) and is a cd, assignment, echo, ls, pwd, true or another touch with nothing
//            evaluated; every cd is `cd <one plain literal>` that exists as a directory under the directory
//            reached so far, and that walk ends where commandCwd (shell-cwd.mjs) ends; no later segment
//            changes the directory.
//     false  anything else, including every cd form the shell resolves by its own rules: no argument, `~`, `-`,
//            an option, `..`, a missing directory, set-location/sl, and an assignment to CDPATH, HOME, OLDPWD
//            or PWD; with CDPATH set in the environment, a cd to a name that is not an explicit path (`./x`, `/x`, `C:/x`).

import { resolve } from 'node:path';
import { commandCwd, isDirectory } from './shell-cwd.mjs';
import { cdTarget, toPath } from './shell-segments.mjs';
import { isOption, tokenize } from './shell-copy-target.mjs';

const PRELUDE_LEADERS = new Set(['cd', 'echo', 'true', 'pwd', 'ls', 'dir', 'get-childitem', 'touch']);
const BARE_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=[^\s$`(){}<>|&;]*$/;
const CD_RESOLUTION_NAMES = new Set(['cdpath', 'home', 'oldpwd', 'pwd']);
const EVALUATING = /[$`(){}]/;
const DIRECTORY_CHANGE = /^\s*(?:cd|chdir|pushd|popd|set-location|sl)(?![\w.-])/i;
const CD_LEADER = /^(?:cd|chdir|pushd|popd|set-location|sl)$/i;
const CD_ARGUMENT = /^cd\s+(\S.*)$/s;
const REDIRECT = /[<>]/;
const DRIVE_RELATIVE = /^[A-Za-z]:(?![\\/])/;
const PARENT_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const EXPLICIT_PATH = /^(?:\.[\\/]|[\\/]|[A-Za-z]:)/;
const FIRST_WORD = /^\S+/;
const UNCONDITIONAL = new Set(['start', ';', '&&']);
const SHELL_FLAVOURS = [false, true];

function isPrelude(text) {
  if (!text || EVALUATING.test(text)) return false;
  const assignment = BARE_ASSIGNMENT.exec(text);
  if (assignment) return !CD_RESOLUTION_NAMES.has(assignment[1].toLowerCase());
  return PRELUDE_LEADERS.has(FIRST_WORD.exec(text)[0].toLowerCase());
}

// The directory `text` moves to from `cwd` when it is `cd <one plain literal>` naming an existing directory; else null.
function followedCd(text, cwd) {
  const argument = CD_ARGUMENT.exec(text);
  if (!argument || REDIRECT.test(argument[1])) return null;
  const parsed = SHELL_FLAVOURS.map((powershell) => tokenize(argument[1], powershell));
  if (parsed.some(({ open, tokens }) => open || tokens.length !== 1 || tokens[0].impure || !tokens[0].v || isOption(tokens[0]))) return null;
  const target = cdTarget(text);
  if (target !== toPath(parsed[0].tokens[0].v) || DRIVE_RELATIVE.test(target) || PARENT_SEGMENT.test(target)) return null;
  if (process.env.CDPATH && !EXPLICIT_PATH.test(target)) return null;
  const next = resolve(cwd, target);
  return isDirectory(next) ? next : null;
}

export function touchPlaceKnown(parts, at, raw, start = process.cwd()) {
  if (!parts.slice(0, at + 1).every((part) => UNCONDITIONAL.has(part.after))) return false;
  if (parts.slice(at + 1).some((part) => DIRECTORY_CHANGE.test(part.text))) return false;
  let cwd = start;
  for (const { text } of parts.slice(0, at)) {
    const trimmed = text.trim();
    if (!isPrelude(trimmed)) return false;
    if (!CD_LEADER.test(FIRST_WORD.exec(trimmed)[0])) continue;
    cwd = followedCd(trimmed, cwd);
    if (!cwd) return false;
  }
  return resolve(commandCwd(raw, start)) === resolve(cwd);
}
