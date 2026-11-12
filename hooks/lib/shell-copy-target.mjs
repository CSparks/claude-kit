// What a cp, mv, Copy-Item or Move-Item call may write, read from the call's argument text under a STRICT allowlist.
//   copyTargets(tool, argText) -> { proven: { sources, destination, landings, under, recursive } | null, writes: string[] }
//
// `proven` is set only for the shapes whose destination is known without running the shell:
//   - the tool is cp, mv, Copy-Item or Move-Item;
//   - every token is a plain literal: no glob, variable, substitution, brace, parenthesis, comment, unquoted
//     backslash (bash tools), backtick or comma (PowerShell tools), non-ASCII character, leading tilde or
//     unterminated quote;
//   - the options are the small set that cannot change where bytes land (cp: -f -p -v -n -r -R, alone or clustered, and
//     their long forms with --recursive; mv: -f -v -n; Copy-Item/Move-Item: -Path -Destination -Force, exact names),
//     plus `-t DIR` / `--target-directory DIR|=DIR` in their exact forms; a quoted token that starts with a dash is an
//     unknown option;
//   - one source and one destination (no trailing slash), or several sources into a directory (the last operand, or
//     -t DIR); each source lands at DIR/<its name>.
// `landings[i]` is where `sources[i]` lands (the destination itself for a pair). `under` is where a source would land
// if the destination turns out to be a directory; a recursive copy adds `<landing>/any.rs`, since anything may land
// beneath it. The caller must still show a landing resolves outside every adopted repo and is no existing directory.
//
// Everything else (any other option or cluster, -a --parents, links, a glob, an unquoted
// backslash, install, the `copy` alias) is uncertain: `writes` then lists every operand, every value glued to an
// option, and `<operand>/any.rs` (anything may land under a directory operand), so a gate judging them fails closed.
// A redirect (`> f`, `2>&1`, `< f`) is cut out of the tokens with its target; the caller judges redirects itself.

const SAFE_SHORT = { cp: 'fpvnrR', mv: 'fvn' };
const SAFE_LONG = { cp: ['--force', '--preserve', '--verbose', '--no-clobber', '--recursive'], mv: ['--force', '--verbose', '--no-clobber'] };
const RECURSIVE_SHORT = /[rR]/;
const SHORT_CLUSTER = /^-([A-Za-z]+)$/;
const PAIR = 2;
const SEVERAL_OPERANDS = PAIR + 1;
const GNU_TOOL = /^(?:cp|mv)$/i;
const PS_TOOL = /^(?:copy-item|move-item)$/i;
const PS_SWITCH = 'force';
const PS_VALUE_PARAMS = ['path', 'destination'];
const REDIRECT_FD = /^(?:\d+|&)$/;
const ENDS_IN_SLASH = /[\\/]$/;
const NON_ASCII = '\\u0080-\\uffff';
const GNU_UNQUOTED_SPECIAL = new RegExp(`[*?[\\]{}()$\`\\\\!#${NON_ASCII}]`);
const PS_UNQUOTED_SPECIAL = new RegExp(`[*?[\\]{}()$\`,#@${NON_ASCII}]`);
const DOUBLE_QUOTED_SPECIAL = /[$`]|\\[$`"\\\n]/;
const OPTION_START = /^[-–—―]/;
const ANY_SOURCE_NAME = 'any.rs';

/** Tokens `{ v, quoted, impure }` of `text` with redirects cut out; `open` when a quote never closes. */
function tokenize(text, powershell) {
  const special = powershell ? PS_UNQUOTED_SPECIAL : GNU_UNQUOTED_SPECIAL;
  const out = [];
  let cur = null;
  let quote = '';
  let dropNext = false;
  const start = (quoted) => { cur = cur || { v: '', quoted, impure: false }; };
  const flush = () => {
    if (cur && dropNext) dropNext = false;
    else if (cur) out.push(cur);
    cur = null;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) { quote = ''; continue; }
      cur.v += ch;
      if (quote === '"' && (DOUBLE_QUOTED_SPECIAL.test(ch + (text[i + 1] || '')) || (powershell && ch === '`'))) cur.impure = true;
      continue;
    }
    if (ch === '"' || ch === "'") { start(true); quote = ch; continue; }
    if (/\s/.test(ch)) { flush(); continue; }
    if (ch === '>' || ch === '<') {
      if (cur && !cur.quoted && REDIRECT_FD.test(cur.v)) cur = null; else flush();
      let j = i + 1;
      if (text[j] === ch) j++;
      const merge = text.slice(j).match(/^&(?:\d+|-)/);
      if (merge) j += merge[0].length; else dropNext = true;
      i = j - 1;
      continue;
    }
    start(false);
    cur.v += ch;
    if (special.test(ch) || (ch === '~' && cur.v === '~')) cur.impure = true;
  }
  const open = quote !== '';
  flush();
  return { tokens: out, open };
}

const stripSlash = (p) => String(p).replace(/[\\/]+$/, '');
const baseName = (p) => stripSlash(p).replace(/.*[\\/]/, '');
const isOption = (t) => OPTION_START.test(t.v);
const shapeOf = (source, destination) => ({ sources: [source], destination, landings: [destination], under: [`${stripSlash(destination)}/${baseName(source)}`], recursive: false });

// Sources copied into a directory: each lands at DIR/<its name>. A lone source named by -t has DIR/<name> as destination.
function directoryShape(sources, dir) {
  const root = stripSlash(dir);
  const landings = sources.map((s) => `${root}/${baseName(s)}`);
  return { sources, destination: sources.length === 1 ? landings[0] : root, landings, under: landings, recursive: false };
}

// A recursive copy writes anything beneath its landing path, so each landing is also judged as a directory.
function recursiveShape(shape) {
  const beneath = [...shape.landings, ...shape.under].map((p) => `${p}/${ANY_SOURCE_NAME}`);
  return { ...shape, recursive: true, under: [...shape.under, ...beneath] };
}

function gnuProven(tool, tokens) {
  const name = tool.toLowerCase();
  const longs = SAFE_LONG[name];
  const positional = [];
  let dir = null;
  let recursive = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isOption(t)) { positional.push(t.v); continue; }
    if (t.quoted) return null;
    const joined = t.v.startsWith('--target-directory=') ? t.v.slice('--target-directory='.length) : null;
    if (t.v === '-t' || t.v === '--target-directory' || joined !== null) {
      const value = joined ?? tokens[++i]?.v;
      if (!value || dir !== null || (joined === null && isOption(tokens[i]))) return null;
      dir = value;
    } else if (SHORT_CLUSTER.test(t.v)) {
      const letters = SHORT_CLUSTER.exec(t.v)[1];
      if (![...letters].every((c) => SAFE_SHORT[name].includes(c))) return null;
      recursive = recursive || RECURSIVE_SHORT.test(letters);
    } else if (longs.includes(t.v)) {
      recursive = recursive || t.v === '--recursive';
    } else return null;
  }
  const shape = plainShape(positional, dir);
  return shape && recursive ? recursiveShape(shape) : shape;
}

// -t DIR takes every operand as a source; otherwise the last of several operands is the directory, and two operands
// are a source and a destination that may be a file or a directory (never named with a trailing slash).
function plainShape(positional, dir) {
  if (dir !== null) return positional.length ? directoryShape(positional, dir) : null;
  if (positional.length >= SEVERAL_OPERANDS) return directoryShape(positional.slice(0, -1), positional.at(-1));
  if (positional.length !== PAIR || ENDS_IN_SLASH.test(positional[1])) return null;
  return shapeOf(positional[0], positional[1]);
}

function psProven(tokens) {
  const positional = [];
  const named = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isOption(t)) { positional.push(t.v); continue; }
    if (t.quoted) return null;
    const colon = t.v.indexOf(':');
    const name = (colon > 0 ? t.v.slice(1, colon) : t.v.slice(1)).toLowerCase();
    if (name === PS_SWITCH && colon < 0) continue;
    if (!PS_VALUE_PARAMS.includes(name) || named[name] !== undefined) return null;
    const value = colon > 0 ? t.v.slice(colon + 1) : tokens[++i]?.v;
    if (!value) return null;
    named[name] = value;
  }
  const source = named.path ?? positional.shift();
  const destination = named.destination ?? positional.shift();
  if (!source || !destination || positional.length || ENDS_IN_SLASH.test(destination)) return null;
  return shapeOf(source, destination);
}

// An option may carry a path: after `=`, after `:` (PowerShell), or glued on (`-tDIR`, `-rtDIR`): every suffix of a short option.
function optionValues(option) {
  const values = option.includes('=') ? [option.slice(option.indexOf('=') + 1)] : [];
  if (option.startsWith('--')) return values;
  return [...values, ...Array.from({ length: Math.max(0, option.length - 2) }, (_, k) => option.slice(k + 2))];
}

/** Every operand as a path a call might write, plus the names a directory operand could receive. */
function everyOperand(tokens) {
  const operands = tokens.flatMap((t) => (isOption(t) ? optionValues(t.v) : [t.v])).filter(Boolean);
  return operands.flatMap((p) => [p, `${stripSlash(p)}/${ANY_SOURCE_NAME}`]);
}

export function copyTargets(tool, argText) {
  const powershell = PS_TOOL.test(tool);
  const { tokens, open } = tokenize(String(argText), powershell);
  const plain = !open && tokens.every((t) => !t.impure);
  const supported = powershell || GNU_TOOL.test(tool);
  const proven = plain && supported ? (powershell ? psProven(tokens) : gnuProven(tool, tokens)) : null;
  return { proven, writes: proven ? [] : everyOperand(tokens) };
}
