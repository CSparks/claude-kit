// What `node [options] <script|-e code> ...` runs, read from node's option grammar (KIT-T939).
//
//   nodeScriptName(args) -> string   args: the words after `node`, quotes dropped
//     the script's file name, or '' when the call runs inline code, stdin, or an option this module cannot place.
//     '' is the safe answer for every caller: the write scan then judges the call, kit-verb recognition lapses.

const VALUE_OPTIONS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '--env-file', '--env-file-if-exists', '-C', '--conditions', '--input-type', '--title', '--stack-trace-limit', '--max-old-space-size']);
const INLINE_LONG = /^--(?:eval|print)(?:=|$)/;
const COMBINED_SHORT = /^-[A-Za-z]+$/;
const INLINE_SHORT_LETTER = /[ep]/;
const VALUE_SHORT_LETTER = /[rC]/;
const BOOLEAN_LONG = /^--(?:no-|enable-|trace-|experimental-)[\w-]+$|^--(?:check|harmony|expose-gc|preserve-symlinks|abort-on-uncaught-exception)$/;
const WITH_VALUE_INLINE = /^--[\w-]+=/;
const END_OF_OPTIONS = '--';

const baseName = (word) => word.replace(/.*[\\/]/, '').replace(/\.exe$/i, '');

export function nodeScriptName(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === END_OF_OPTIONS) return args[i + 1] ? baseName(args[i + 1]) : '';
    if (!a.startsWith('-')) return baseName(a);
    if (a === '-') return '';
    if (INLINE_LONG.test(a)) return '';
    if (VALUE_OPTIONS.has(a)) { i++; continue; }
    if (WITH_VALUE_INLINE.test(a) || BOOLEAN_LONG.test(a)) continue;
    if (a === '-c') continue;
    if (COMBINED_SHORT.test(a)) {
      const letters = a.slice(1);
      if (INLINE_SHORT_LETTER.test(letters)) return '';
      if (VALUE_SHORT_LETTER.test(letters)) { i++; continue; }
    }
    return '';
  }
  return '';
}
