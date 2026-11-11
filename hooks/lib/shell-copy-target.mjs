// What a cp, mv, install, Copy-Item or Move-Item call READS and WRITES, read from the call's argument text.
//   copyTargets(tool, argText) -> { destinations: string[], sources: string[], certain: boolean }
//     certain: the destination is known. When it is not (an option that may take a value, an ambiguous PowerShell
//     parameter, an unterminated quote, a missing value) `destinations` is empty and `sources` holds EVERY
//     operand, so a gate judging them fails closed.
// The text is tokenized first: a quoted span stays whole, and a redirect (`> f`, `2>&1`, `>> "a b"`, `< f`) is cut out
// with the target that follows it, never by a pattern that ignores quoting. A token `quoted` is one that opens
// with a quote: its text is an operand whatever it starts with. A destination directory (`-t DIR`, an
// operand ending in a slash) receives each source under its own file name, so those paths are the ones judged.

const GNU_ARG_SHORT = 'tSmog';
const GNU_PLAIN_SHORT = 'rRfinvpaulsLPHdxbTZ';
const GNU_PLAIN_LONG = /^(?:recursive|force|interactive|no-clobber|verbose|preserve|archive|update|link|symbolic-link|dereference|no-dereference|parents|backup|no-target-directory|remove-destination|attributes-only|one-file-system|debug|reflink|directory|compare)$/;
const GNU_ARG_LONG = /^(?:suffix|mode|owner|group)$/;
const TARGET_DIRECTORY = 'target-directory';
const PS_ARG_PARAMS = ['path', 'literalpath', 'destination', 'filter', 'include', 'exclude', 'credential', 'fromsession', 'tosession', 'erroraction', 'warningaction', 'informationaction', 'errorvariable', 'warningvariable', 'informationvariable', 'outvariable', 'outbuffer', 'pipelinevariable'];
const PS_SWITCH_PARAMS = ['force', 'container', 'recurse', 'passthru', 'whatif', 'confirm', 'usetransaction', 'debug', 'verbose'];
const PS_TOOL = /^(?:copy-item|move-item|copy)$/i;
const REDIRECT_FD = /^(?:\d+|&)$/;
const ENDS_IN_SLASH = /[\\/]$/;

/** The argument tokens `{ v, quoted }` of `text` with redirects removed; `open` when a quote never closes. */
function tokenize(text) {
  const out = [];
  let cur = null;
  let quote = '';
  let dropNext = false;
  const flush = () => {
    if (cur && dropNext) dropNext = false;
    else if (cur) out.push(cur);
    cur = null;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = ''; else cur.v += ch; continue; }
    if (ch === '"' || ch === "'") { cur = cur || { v: '', quoted: true }; quote = ch; continue; }
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
    cur = cur || { v: '', quoted: false };
    cur.v += ch;
  }
  const open = quote !== '';
  flush();
  return { tokens: out, open };
}

const baseName = (p) => String(p).replace(ENDS_IN_SLASH, '').replace(/.*[\\/]/, '');
const into = (dir, sources) => (sources.length
  ? sources.map((s) => `${dir.replace(ENDS_IN_SLASH, '')}/${baseName(s)}`)
  : [dir]);
const resolved = (dest, sources) => ({ destinations: ENDS_IN_SLASH.test(dest) ? into(dest, sources) : [dest], sources, certain: true });
const unknown = (tokens) => ({ destinations: [], sources: tokens.map((t) => t.v), certain: false });

// cp, mv, install: options may sit among the operands; `-t DIR` / `--target-directory=DIR` (any unambiguous prefix,
// a joined `-tDIR`, a cluster `-rt DIR`) name the destination directory, else it is the last operand.
function gnuTargets(tokens) {
  const positional = [];
  let dir = null;
  let optionsDone = false;
  for (let i = 0; i < tokens.length; i++) {
    const { v, quoted } = tokens[i];
    if (optionsDone || quoted || !v.startsWith('-') || v === '-') { positional.push(v); continue; }
    if (v === '--') { optionsDone = true; continue; }
    if (v.startsWith('--')) {
      const [name, ...rest] = v.slice(2).split('=');
      const joined = rest.length ? rest.join('=') : null;
      if (name && TARGET_DIRECTORY.startsWith(name)) {
        const value = joined ?? tokens[++i]?.v;
        if (value === undefined || dir !== null) return null;
        dir = value;
      } else if (GNU_ARG_LONG.test(name)) {
        if ((joined ?? tokens[++i]?.v) === undefined) return null;
      } else if (!GNU_PLAIN_LONG.test(name)) return null;
      continue;
    }
    for (let k = 1; k < v.length; k++) {
      const c = v[k];
      if (GNU_ARG_SHORT.includes(c)) {
        const value = v.slice(k + 1) || tokens[++i]?.v;
        if (value === undefined || (c === 't' && dir !== null)) return null;
        if (c === 't') dir = value;
        break;
      }
      if (!GNU_PLAIN_SHORT.includes(c)) return null;
    }
  }
  if (dir !== null) return { destinations: into(dir, positional), sources: positional, certain: true };
  if (positional.length < 2) return null;
  return resolved(positional.at(-1), positional.slice(0, -1));
}

// The one PowerShell parameter `name` (case-insensitive, an unambiguous prefix) names, or '' when none or several.
function psParameter(name) {
  const lower = name.toLowerCase();
  const all = [...PS_ARG_PARAMS, ...PS_SWITCH_PARAMS];
  if (all.includes(lower)) return lower;
  const matches = all.filter((p) => p.startsWith(lower));
  return matches.length === 1 ? matches[0] : '';
}

// Copy-Item, Move-Item: `-Destination X` or `-Destination:X`, else the second positional (Path, Destination).
function psTargets(tokens) {
  const positional = [];
  const named = {};
  for (let i = 0; i < tokens.length; i++) {
    const { v, quoted } = tokens[i];
    if (quoted || !/^-[A-Za-z]/.test(v)) { positional.push(v); continue; }
    const colon = v.indexOf(':');
    const param = psParameter(colon > 0 ? v.slice(1, colon) : v.slice(1));
    if (!param) return null;
    if (PS_SWITCH_PARAMS.includes(param)) continue;
    const value = colon > 0 ? v.slice(colon + 1) : tokens[++i]?.v;
    if (value === undefined || named[param] !== undefined) return null;
    named[param] = value;
  }
  const path = named.path ?? named.literalpath ?? positional.shift();
  const dest = named.destination ?? positional.shift();
  if (path === undefined || dest === undefined || positional.length) return null;
  return resolved(dest, path.split(','));
}

export function copyTargets(tool, argText) {
  const { tokens, open } = tokenize(String(argText));
  const known = open ? null : (PS_TOOL.test(tool) ? psTargets(tokens) : gnuTargets(tokens));
  return known || unknown(tokens);
}
