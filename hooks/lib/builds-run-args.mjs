// builds-run-args.mjs — the whole surface of a `builds --run` launcher call as an ALLOWLIST (KIT-T1284): nothing the gate
// cannot read is accepted, and no option is parsed for what it might mean.
//
//   builds --run "<command>" [--out <file>] [--limit <n>] [--timeout <n>] [--tool-timeout <n>]
//
//   launcherProblem(tokens, cwd) -> '' | why the call is refused
//     tokens: the call's quote-aware tokens (commandTokens), `builds` first; cwd: the directory the call runs in
// Every token must be one of those: `--run` once with its command, and each other flag once with one value (`--flag value` or
// `--flag=value`, quotes allowed). `--out` names a file the verb WRITES, so it must resolve under target/ or the temp directory
// (the session scratchpad lives there) and be a plain literal (no variable, substitution, glob, tilde or %VAR%); the others take
// numbers. Any other flag (`--cwd` included), a bare word, a repeated flag or a missing value is refused.

import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, posix, resolve } from 'node:path';
import { dequoted } from './shell-segments.mjs';
import { isGeneratedPath, slashed } from './source-path.mjs';

const RUN = '--run';
const NUMERIC = ['limit', 'timeout', 'tool-timeout'];
const FLAG = /^--(out|limit|timeout|tool-timeout)(?:=([^]*))?$/;
const CWD_OPTION = /^--cwd(?:=|$)/;
const NUMBER = /^\d+(?:\.\d+)?$/;
const UNRESOLVABLE = /^~|[$`()*?[\]{}<>|;&%!]/;
const ALLOWED_OUT = 'a path under target/ or the session scratchpad (the temp directory)';

export const CWD_REFUSAL = 'builds --run with a working-directory option (--cwd) is refused: run it from the project root with paths relative to the root, or put the directory change inside the quoted command (cd <dir> && ...) where the gate reads it.';
const SHELL_TMP = /^\/(?:var\/)?tmp(?:\/|$)/;
const surface = (why) => `builds --run takes only --run "<command>", --out <file> (${ALLOWED_OUT}) and numbers for --limit, --timeout and --tool-timeout; ${why}.`;

function tempRoots() {
  const roots = [tmpdir()];
  try { roots.push(realpathSync.native(tmpdir())); } catch { /* the raw spelling stays */ }
  return roots.map((r) => slashed(r).toLowerCase().replace(/\/$/, ''));
}

// A relative value must stay under a target/ directory; an absolute one must be under target/ or the temp directory. The
// temp directory is no allowance for a relative value (a checkout may sit under it).
function outProblem(value, cwd) {
  if (value === '' || UNRESOLVABLE.test(value)) return `--out ${value || '(empty)'} cannot be resolved statically`;
  const text = slashed(value);
  const absolute = isAbsolute(text) || /^[A-Za-z]:\//.test(text);
  const path = slashed(absolute ? resolve(text) : resolve(cwd, text));
  const underTarget = /(?:^|\/)target\//.test(path) && isGeneratedPath(path);
  const inTemp = absolute && tempRoots().some((root) => path.toLowerCase().startsWith(`${root}/`));
  const escapes = !absolute && posix.normalize(text).startsWith('../');
  if (!escapes && (underTarget || inTemp)) return '';
  const shellTmp = SHELL_TMP.test(text) ? `; /tmp is not the session scratchpad: use --out target/<file>` : '';
  return `--out ${value} is not ${ALLOWED_OUT}${shellTmp}`;
}

export function launcherProblem(tokens, cwd) {
  const seen = new Set();
  for (let i = 1; i < tokens.length; i++) {
    const word = dequoted(tokens[i]).replace(/["']/g, '');
    if (CWD_OPTION.test(word)) return CWD_REFUSAL;
    if (word === RUN) {
      if (seen.has(RUN) || i + 1 >= tokens.length) return surface('--run needs exactly one command');
      seen.add(RUN);
      i += 1;
      continue;
    }
    const flag = FLAG.exec(word);
    if (!flag) return surface(`${word.length > 40 ? `${word.slice(0, 40)}...` : word} is not one of them`);
    const [, name, inline] = flag;
    if (seen.has(name)) return surface(`--${name} is given twice`);
    seen.add(name);
    const raw = inline ?? (i + 1 < tokens.length ? dequoted(tokens[i + 1]) : undefined);
    if (raw === undefined || (inline === undefined && String(raw).startsWith('--'))) return surface(`--${name} has no value`);
    if (inline === undefined) i += 1;
    const value = String(raw).trim();
    if (NUMERIC.includes(name) && !NUMBER.test(value)) return surface(`--${name} ${value} is not a number`);
    if (name === 'out') {
      const problem = outProblem(value, cwd);
      if (problem) return surface(problem);
    }
  }
  return seen.has(RUN) ? '' : surface('--run is missing');
}
