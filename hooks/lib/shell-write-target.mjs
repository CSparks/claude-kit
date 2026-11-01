// Which paths a script's filesystem write calls aim at (KIT-T792): a script that reads a source file and writes a scratchpad
// patch is a reader of the tree. Resolves each call's path argument through `const x = ...` definitions.
//
//   writeCallTargets(code) -> string[] | null
//     the string literals that make up the path of every write call; null when any call's path cannot be resolved
//     (a loop variable, a property, an unknown function, a receiver-style `p.write_text(...)`) or the code holds a write
//     shape this module does not read, so the caller keeps its whole-script rule.

import { FS_WRITE, WRITE_CALLS, WRITE_NAMES } from './shell-write-scan.mjs';

const CALL = new RegExp(String.raw`(?:\b(?:${WRITE_NAMES})|\.(?:${WRITE_CALLS}))\s*\(`, 'g');
const FIRST_ARG_ONLY = /^(?:writeFile|writeFileSync|writeSync|writev|writevSync|appendFile|appendFileSync|openSync|createWriteStream|outputFile|WriteAll\w+|truncate|truncateSync|ftruncateSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync)$/;
const RECEIVER_STYLE = /^(?:write_text|write_bytes|touch)$/;
const PATH_FUNCTIONS = new Set(['join', 'resolve', 'normalize', 'relative', 'basename', 'dirname', 'extname', 'String', 'tmpdir']);
const PATH_MODULES = new Set(['path', 'posix', 'win32', 'os']);
const MAX_DEPTH = 4;
const QUOTES = new Set(['"', "'", '`']);
const OPENERS = '([{';
const CLOSERS = ')]}';

/** The text from `from` up to the first top-level stop character (or the closing bracket), honouring strings. */
function takeUntil(code, from, stops) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (QUOTES.has(c)) { i = endOfString(code, i); continue; }
    if (OPENERS.includes(c)) depth++;
    else if (CLOSERS.includes(c)) { if (depth === 0) return code.slice(from, i); depth--; }
    else if (depth === 0 && stops.includes(c)) return code.slice(from, i);
  }
  return code.slice(from);
}

function endOfString(code, start) {
  const quote = code[start];
  for (let i = start + 1; i < code.length; i++) {
    if (code[i] === '\\') i++;
    else if (code[i] === quote) return i;
  }
  return code.length;
}

/** { literals, names } of an expression: string pieces (template interpolations unwrapped) and the bare identifiers left. */
function pieces(expr) {
  const literals = [];
  let rest = '';
  for (let i = 0; i < expr.length; i++) {
    if (!QUOTES.has(expr[i])) { rest += expr[i]; continue; }
    const end = endOfString(expr, i);
    const body = expr.slice(i + 1, end);
    if (expr[i] === '`') {
      const inner = [...body.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
      literals.push(body.replace(/\$\{[^}]*\}/g, ''));
      rest += ` ${inner.join(' + ')} `;
    } else literals.push(body);
    rest += ' ';
    i = end;
  }
  return { literals, rest };
}

function identifiersOf(rest) {
  const names = [];
  for (const m of rest.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(\s*[.(])?/g)) {
    const [, name, after] = m;
    if (PATH_MODULES.has(name) && after?.trim() === '.') continue;
    if (PATH_FUNCTIONS.has(name) && after?.trim() === '(') continue;
    names.push(name);
  }
  return names;
}

function member(rest) {
  return /(?<=[\w$\])])\s*\.\s*[A-Za-z_$]/.test(rest.replace(/\b(?:path|posix|win32|os)\s*\.\s*(?:join|resolve|normalize|relative|basename|dirname|extname|sep|tmpdir)\b/g, ''));
}

function resolve(expr, code, depth) {
  if (depth > MAX_DEPTH) return null;
  const { literals, rest } = pieces(expr);
  if (member(rest) || /\[/.test(rest)) return null;
  const out = [...literals];
  for (const name of identifiersOf(rest)) {
    const def = new RegExp(String.raw`\b(?:const|let|var)\s+${name.replace(/\$/g, '\\$')}\s*=\s*`).exec(code);
    if (!def) return null;
    const inner = resolve(takeUntil(code, def.index + def[0].length, ';\n'), code, depth + 1);
    if (!inner) return null;
    out.push(...inner);
  }
  return out;
}

export function writeCallTargets(code) {
  const text = String(code);
  const calls = [...text.matchAll(CALL)];
  if (!calls.length || FS_WRITE.test(text.replace(CALL, ' '))) return null;
  const targets = [];
  for (const m of calls) {
    const name = m[0].replace(/\s*\($/, '').replace(/^\./, '');
    const args = takeUntil(text, m.index + m[0].length, '');
    if (RECEIVER_STYLE.test(name) || (m[0].startsWith('.') && !args.trim())) return null;
    const path = FIRST_ARG_ONLY.test(name) ? takeUntil(text, m.index + m[0].length, ',') : args;
    const found = resolve(path, text, 0);
    if (!found || !found.length) return null;
    targets.push(...found);
  }
  return targets;
}
