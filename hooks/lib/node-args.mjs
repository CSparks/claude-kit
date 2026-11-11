// What `node [options] <script|-e code> ...` runs, read from node's option grammar (KIT-T939).
//
//   isNodeInlineFlag(arg) -> boolean   arg carries inline code: -e, -p, --eval[=], --print[=], or combined short flags with e or p (-pe)
//   nodeLoadedModules(args) -> string[]  the module or file each code-loading option names, in call order
//   nodeTestFiles(args) -> string[]|null  the test files a `node --test` or `node x.test.mjs` call runs; null for any other call
//   nodeScriptName(args) -> string     args: the words after `node`, quotes dropped
//     the script's file name, or '' when the call runs inline code, stdin, loads code before the script
//     (-r, --require, --import, --loader, --experimental-loader, --env-file[-if-exists], in any spelling), or uses
//     an option this module cannot place.
//     '' is the safe answer for every caller: the write scan then judges the call, kit-verb recognition lapses.

const HARMLESS_VALUE_OPTIONS = new Set(['-C', '--conditions', '--input-type', '--title', '--stack-trace-limit']);
const CODE_LOADING_LONG = /^--(?:require|import|loader|experimental-loader|env-file|env-file-if-exists)(?:=|$)/;
const CODE_LOADING_SHORT = /^-[A-Za-z]*r/;
const INLINE_LONG = /^--(?:eval|print)(?:=|$)/;
const COMBINED_SHORT = /^-[A-Za-z]+$/;
const INLINE_SHORT_LETTER = /[ep]/;
const BOOLEAN_LONG = /^--(?:no-|enable-|trace-)[\w-]+$|^--(?:check|harmony|expose-gc|preserve-symlinks|abort-on-uncaught-exception)$/;
const SELF_CONTAINED_LONG = /^--(?:conditions|input-type|title|stack-trace-limit|max-old-space-size|max-http-header-size)=/;
const CHECK_SHORT = '-c';
const STDIN = '-';
const END_OF_OPTIONS = '--';

const baseName = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');

export const isNodeInlineFlag = (arg) => INLINE_LONG.test(arg) || (COMBINED_SHORT.test(arg) && INLINE_SHORT_LETTER.test(arg));

const loadsCode = (arg) => CODE_LOADING_LONG.test(arg) || (!arg.startsWith('--') && CODE_LOADING_SHORT.test(arg));

function attachedValue(arg) {
  if (!arg.startsWith('--')) return arg.slice(arg.indexOf('r') + 1);
  const eq = arg.indexOf('=');
  return eq < 0 ? '' : arg.slice(eq + 1);
}

/** The modules (or env files) the options before the script load, joined or separate: node runs each before the script. */
export function nodeLoadedModules(args) {
  const loaded = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === END_OF_OPTIONS || a === STDIN || !a.startsWith('-')) break;
    if (HARMLESS_VALUE_OPTIONS.has(a)) { i++; continue; }
    if (!loadsCode(a)) continue;
    const value = attachedValue(a) || args[++i];
    if (value) loaded.push(value);
  }
  return loaded;
}

export function nodeScriptName(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === END_OF_OPTIONS) return args[i + 1] ? baseName(args[i + 1]) : '';
    if (!a.startsWith('-')) return baseName(a);
    if (a === STDIN || isNodeInlineFlag(a) || loadsCode(a)) return '';
    if (HARMLESS_VALUE_OPTIONS.has(a)) { i++; continue; }
    if (a === CHECK_SHORT || SELF_CONTAINED_LONG.test(a) || BOOLEAN_LONG.test(a)) continue;
    return '';
  }
  return '';
}

const TEST_OPTION = /^--test(?:=|$)/;
const PLAIN_OPTION = /^--[\w-]+(?:=\S*)?$/;
const TEST_SCRIPT = /\.test\.(?:m?js|cjs)$/i;

/**
 * The test files `node [options] <files>` runs when it is node's test runner: `--test` among the options before the
 * first file, or a single `*.test.(m)js` script, and no inline code, stdin, preloaded module or option this module
 * cannot place. Arguments after the first file belong to that file, never to node. null when the call is anything else.
 */
export function nodeTestFiles(args) {
  const files = [];
  let runner = false;
  let at = 0;
  for (; at < args.length; at++) {
    const a = args[at];
    if (a === END_OF_OPTIONS) { at++; break; }
    if (!a.startsWith('-')) break;
    if (TEST_OPTION.test(a)) { runner = true; continue; }
    if (a === STDIN || isNodeInlineFlag(a) || loadsCode(a) || !PLAIN_OPTION.test(a)) return null;
  }
  if (nodeLoadedModules(args).length) return null;
  files.push(...(runner ? args.slice(at).filter((a) => !a.startsWith('-')) : args.slice(at, at + 1)));
  const isTestPath = (f) => TEST_SCRIPT.test(f) || (runner && !/\.[A-Za-z0-9]+$/.test(f));
  if (!runner && files.length !== 1) return null;
  return files.every(isTestPath) ? files : null;
}
