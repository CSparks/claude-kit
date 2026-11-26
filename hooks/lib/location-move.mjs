// location-move.mjs — how one segment moves the directory of the shell that runs it, read for the push gates (KIT-T1601).
//
//   locationMove(seg, shell) -> null (no location command) | one of
//     { to }              cd, chdir, Set-Location, sl to one resolved path
//     { to, push: true }  pushd, Push-Location to one resolved path: the directory before it goes on the stack
//     { pop: true }       a bare popd or Pop-Location
//     { swap: true }      a bare bash pushd: the top of the stack and the directory trade places
//     { pushHere: true }  a bare PowerShell Push-Location: the directory goes on the stack and stays
//     { back: true }      cd - or Set-Location -: the directory before the last move
//     { unknown: true }   a location command whose effect the gate cannot resolve: a variable, a substitution, a wildcard, a
//                         home directory, an option other than -Path or -LiteralPath, popd with arguments, more than one
//                         path, a group or a wrapper in front of it
//   shell: 'powershell' (its verbs in any case), 'bash' (cd, pushd, popd), anything else the union of both in any case.
//   A verb the shell lacks is no location command there: the shell fails it and stays where it was.
//
//   locationWalk(start, { resolveDir, isDirectory }) -> { dirs(), step(move) }
//     the directories the shell may be in as a command's segments run: one while every move resolves; after a move the gate
//     cannot resolve (UNKNOWN, `cd -` or popd with nothing known to return to), every directory the command reached so far.
//     A move into a missing directory fails in the shell, so the directory before it stays a candidate.
//
// Tokens are read without their redirections (commandTokens), quotes removed (dequoted).

import { commandTokens } from './lead-command-walk.mjs';
import { dequoted, toPath } from './shell-segments.mjs';

const VERBS = {
  powershell: { move: /^(?:cd|chdir|set-location|sl)$/i, push: /^(?:pushd|push-location)$/i, pop: /^(?:popd|pop-location)$/i },
  bash: { move: /^cd$/, push: /^pushd$/, pop: /^popd$/ },
  any: { move: /^(?:cd|chdir|set-location|sl)$/i, push: /^(?:pushd|push-location)$/i, pop: /^(?:popd|pop-location)$/i },
};
const PATH_OPTION = /^-(?:path|literalpath)(?::(.*))?$/i;
const BACK = '-';
const STACK_INDEX = /^[+-]\d+$/;
// A shell expands these, so the path is not the text: a variable, a substitution, a group, a wildcard, a home directory.
const UNRESOLVED = /[$`(){}*?[\]%]|^~/;
const GROUP_PREFIX = /^[({!]+/;
const WRAPPER = /^(?:builtin|command|exec)$/i;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const UNKNOWN = Object.freeze({ unknown: true });

const verbsOf = (shell) => VERBS[shell] || VERBS.any;
const kindOf = (verbs, word) => ['move', 'push', 'pop'].find((kind) => verbs[kind].test(word)) || '';

// The single path the arguments name: '' with none, null when they cannot be resolved to exactly one.
function onePath(args, shell) {
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    const option = PATH_OPTION.exec(args[i]);
    if (option && shell !== 'bash') paths.push(option[1] ?? args[++i]);
    else if ((args[i].startsWith('-') && args[i] !== BACK) || STACK_INDEX.test(args[i])) return null;
    else paths.push(args[i]);
  }
  if (paths.length > 1 || paths.some((p) => p === undefined || UNRESOLVED.test(p))) return null;
  return paths[0] ?? '';
}

export function locationMove(seg, shell = '') {
  const raw = commandTokens(String(seg).trim());
  const verbs = verbsOf(shell);
  let at = 0;
  const bareGroup = (token) => GROUP_PREFIX.test(token) && !token.replace(GROUP_PREFIX, '');
  while (at < raw.length && (WRAPPER.test(raw[at]) || ASSIGNMENT.test(raw[at]) || bareGroup(raw[at]))) at++;
  if (at >= raw.length) return null;
  const grouped = GROUP_PREFIX.test(raw[at]);
  const word = dequoted(raw[at].replace(GROUP_PREFIX, ''));
  const kind = kindOf(verbs, word);
  if (!kind) return null;
  if (at > 0 || grouped || raw.some((t) => /[)}]$/.test(t) && !/^["']/.test(t))) return UNKNOWN;
  const args = raw.slice(at + 1).map(dequoted);
  if (kind === 'pop') return args.length ? UNKNOWN : { pop: true };
  const path = onePath(args, shell);
  if (path === null) return UNKNOWN;
  if (path === BACK) return kind === 'move' ? { back: true } : UNKNOWN;
  if (path === '') return kind === 'move' ? UNKNOWN : shell === 'bash' ? { swap: true } : shell === 'powershell' ? { pushHere: true } : UNKNOWN;
  return kind === 'push' ? { to: toPath(path), push: true } : { to: toPath(path) };
}

const unique = (dirs) => [...new Set(dirs)];

export function locationWalk(start, { resolveDir, isDirectory }) {
  let dirs = unique([start].flat());
  let previous = null;
  const stack = [];
  const reached = new Set(dirs);
  const go = (next) => { previous = dirs; dirs = unique(next); dirs.forEach((d) => reached.add(d)); };
  const unknown = () => go([...reached]);
  const into = (to) => dirs.flatMap((d) => { const next = resolveDir(d, to); return isDirectory(next) ? [next] : [d, next]; });
  const step = (move) => {
    if (move.unknown) unknown();
    else if (move.to !== undefined) { if (move.push) stack.push(dirs); go(into(move.to)); }
    else if (move.pushHere) stack.push(dirs);
    else if (move.pop) { if (stack.length) go(stack.pop()); else unknown(); }
    else if (move.swap) { if (stack.length) { const top = stack.pop(); stack.push(dirs); go(top); } else unknown(); }
    else if (move.back) { if (previous) go(previous); else unknown(); }
  };
  return { dirs: () => dirs, step };
}
