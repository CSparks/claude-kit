// env-change.mjs — the environment changes a command text makes, judged fail-closed (KIT-T1262). A git call is judged
// precisely only when nothing in the command redirects it through the environment (git-call-policy.mjs), so a change that
// cannot be read as a plain read is a change. Reading `$env:TEMP` is a read; everything else naming the environment is not.
//
//   environmentChanges(text) -> [{ index, end, name }]   every environment change in `text`, in order; `name` is the variable
//     the change sets when the text spells it as a literal, else null (a computed name, quoting, an Env: drive path, a call
//     that sets any variable, `set -a`)
//
// A PowerShell `$env:NAME` / `${env:NAME}` is a read unless an assignment operator, a comma (a multiple assignment) or ++/--
// follows it. An `Env:` drive reference is a read only as the argument of Get-Item, Get-ChildItem, Get-Content or Test-Path (or
// gi, gci, ls, dir, gc, cat) in a segment with no assignment, no `-*Variable` parameter and no grouping; any other reference
// (Set-/New-/Remove-/Clear-/Rename-/Copy-/Move-Item and their aliases, Set-/Add-/Clear-Content, Set-Location, a bare path) is a change.
// `[Environment]` is a read only as `::GetEnvironmentVariable(s)(`; `SetEnvironmentVariable` is always a change. A bash export,
// `declare -x`, `typeset -x`, `setenv` or `set -a` is a change; its names are literal only when each word is `NAME` or `NAME=value`.

const ENV_TOKEN = /\$env:([A-Za-z_][\w]*)|\$\{env:([^}]*)\}|\$env:/gi;
const ASSIGNS_AFTER = /^\s*(?:(?:[-+*/%]|\?\?)?=(?!=)|,|\+\+|--)/;
const DRIVE_REF = /(?<![\w$])env:/gi;
const READ_CMD = '(?:get-item|get-childitem|get-content|test-path|gi|gci|ls|dir|gc|cat)';
const READ_SEGMENT = new RegExp(`^\\s*(?:\\$\\w+\\s*=\\s*)?${READ_CMD}(?![\\w-])`, 'i');
const SINK_SEGMENT = /^\s*(?:out-null|out-string|out-host|select-object|select|select-string|sls|sort-object|sort|measure-object|measure|format-list|fl|format-table|ft)(?![\w-])/i;
const VARIABLE_PARAM = /\s-(?:\w*variable|ov|ev|wv|iv|pv)(?![\w-])/i;
const SEGMENT_BREAKS = /[;|&\n]/;
const GROUPING = /[(){}`]/;
const ENV_CLASS = /\[\s*(?:system\.)?environment\s*\]/gi;
const ENV_READ_CALL = /^\s*::\s*get(?:environmentvariable|environmentvariables)\s*\(/i;
const SET_VARIABLE = /SetEnvironmentVariable\s*\(\s*(['"])([A-Za-z_]\w*)\1\s*,/gi;
const BASH_EXPORT = /(?<![\w-])(export|setenv|declare\s+-[A-Za-z]*x|typeset\s+-[A-Za-z]*x|set\s+(?:-[A-Za-z]*a\b|-o\s+allexport))(?![\w-])([^;&|\n]*)/gi;
const WORD_NAME = /^([A-Za-z_]\w*)(?:=.*)?$/;
const blank = (text, from, to) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to);

function powershellVariableChanges(text) {
  const found = [];
  let rest = text;
  for (const m of text.matchAll(ENV_TOKEN)) {
    const end = m.index + m[0].length;
    rest = blank(rest, m.index, end);
    if (m[1] === undefined && m[2] === undefined) found.push({ index: m.index, end, name: null });
    else if (ASSIGNS_AFTER.test(text.slice(end))) found.push({ index: m.index, end, name: m[1] ?? (WORD_NAME.test(m[2]) ? m[2] : null) });
  }
  return { found, rest };
}

const plain = (segment) => !GROUPING.test(segment) && !VARIABLE_PARAM.test(segment) && !/=/.test(segment.replace(/^\s*\$\w+\s*=/, ''));

// A pipeline that reads the Env: drive may only end in a sink that cannot write to it: Set-Item and friends fed from the pipe
// would change the variable the read named.
function readsOnly(parts, from) {
  if (!READ_SEGMENT.test(parts[from]) || !plain(parts[from])) return false;
  for (let i = from + 1; parts[i] === '|'; i += 2) {
    if (!SINK_SEGMENT.test(parts[i + 1] ?? '') || !plain(parts[i + 1])) return false;
  }
  return true;
}

function driveChanges(rest) {
  const found = [];
  const parts = rest.split(new RegExp(`(${SEGMENT_BREAKS.source})`));
  let offset = 0;
  parts.forEach((segment, i) => {
    const at = segment.search(/(?<![\w$])env:/i);
    if (at >= 0 && !readsOnly(parts, i)) found.push({ index: offset + at, end: offset + at + 4, name: null });
    offset += segment.length;
  });
  return found;
}

function environmentClassChanges(text) {
  const found = [];
  for (const m of text.matchAll(ENV_CLASS)) {
    const end = m.index + m[0].length;
    if (!ENV_READ_CALL.test(text.slice(end))) found.push({ index: m.index, end, name: null });
  }
  for (const m of text.matchAll(SET_VARIABLE)) found.push({ index: m.index, end: m.index + m[0].length, name: m[2] });
  for (const m of text.matchAll(/SetEnvironmentVariable/gi)) {
    if (!found.some((f) => f.index <= m.index && m.index < f.end + 1)) found.push({ index: m.index, end: m.index + m[0].length, name: null });
  }
  return found;
}

function bashChanges(text) {
  return [...text.matchAll(BASH_EXPORT)].flatMap((m) => {
    const end = m.index + m[0].length;
    const words = m[2].trim().split(/\s+/).filter((w) => w && !w.startsWith('-'));
    const named = /^(?:set\s)/i.test(m[1]) ? [] : words.map((w) => WORD_NAME.exec(w)?.[1]);
    const literal = named.length > 0 && named.every(Boolean);
    return literal ? named.map((name) => ({ index: m.index, end, name })) : [{ index: m.index, end, name: null }];
  });
}

export function environmentChanges(text) {
  const source = String(text || '');
  const { found, rest } = powershellVariableChanges(source);
  return [...found, ...driveChanges(rest), ...environmentClassChanges(source), ...bashChanges(source)].sort((a, b) => a.index - b.index);
}
