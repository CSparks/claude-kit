// env-change.mjs — does a command text change the environment? Judged by INVERSION (KIT-T1262): the text is a change unless
// every mention of the environment in it is one of a small fixed set of known READ forms. Nothing lists the ways to change
// the environment, so a form nobody listed (a provider path, a flag group, a quoted keyword) is a change, never a pass.
//
//   environmentChanges(text) -> [{ index, end, text }]   the mentions left once the known read forms are blanked, in the
//     text with quotes, backslashes and backticks removed (so `'export'`, `\export` and `ex""port` read as `export`)
//   environmentChangeBeforeGit(text) -> boolean          a mention with a `git` word after it in the same text
//
// Mentions: `env:` (the Env: drive, `$env:`), `Environment` (the provider, the .NET class, -PSProvider Environment),
// `PSDrive` and `PSProvider`, and the shell words export, setenv, declare, typeset, local and `set -`.
// Read forms, blanked before the scan:
//   PowerShell  `$env:NAME` and `${env:NAME}` with no assignment operator, comma (multiple assignment) or ++/-- after it;
//               Get-Item, Get-ChildItem, Get-Content or Test-Path (gi, gci, ls, dir, gc, cat) on a literal `Env:` or
//               `Env:NAME` in a segment with no assignment, grouping or -*Variable parameter, its pipeline ending in
//               Out-Null, Out-String, Out-Host, Select-Object, Select-String, Sort-Object, Measure-Object, Format-List or
//               Format-Table; `[Environment]::GetEnvironmentVariable(s)(` with a literal name and target
//   bash        `$NAME`, `${NAME}`, `printenv NAME` and `env` with no arguments name no mention and pass as they are

const ENV_VARIABLE = /\$env:([A-Za-z_]\w*)|\$\{env:([^}]*)\}/gi;
const ASSIGNS_AFTER = /^\s*(?:(?:[-+*/%]|\?\?)?=(?!=)|,|\+\+|--)/;
const READ_CMD = '(?:get-item|get-childitem|get-content|test-path|gi|gci|ls|dir|gc|cat)';
const READ_SEGMENT = new RegExp(`^\\s*(?:\\$\\w+\\s*=\\s*)?${READ_CMD}(?![\\w-])`, 'i');
const SINK_SEGMENT = /^\s*(?:out-null|out-string|out-host|select-object|select|select-string|sls|sort-object|sort|measure-object|measure|format-list|fl|format-table|ft)(?![\w-])/i;
const VARIABLE_PARAM = /\s-(?:\w*variable|ov|ev|wv|iv|pv)(?![\w-])/i;
const SEGMENT_BREAKS = /([;|&\n])/;
const GROUPING = /[(){}`]/;
const LITERAL_DRIVE_REF = /(?<![\w$])env:(?:[\\/]?[A-Za-z_][\w().-]*)?(?=\s|,|$)/gi;
const NAME = '[A-Za-z_][\\w()-]*';
const TARGET = '(?:(?:\\[\\s*(?:System\\.)?EnvironmentVariableTarget\\s*\\]::)?(?:Process|User|Machine)|([\'"])(?:Process|User|Machine)\\2)';
const LITERAL_GET_CALL = new RegExp(`\\[\\s*(?:System\\.)?Environment\\s*\\]::GetEnvironmentVariables?\\(\\s*(?:(['"])${NAME}\\1\\s*(?:,\\s*${TARGET}\\s*)?)?\\)`, 'gi');
const MENTION = /env:|environment|psdrive|psprovider|(?<![\w-])(?:export|setenv|declare|typeset|local)(?![\w-])|(?<![\w-])set\s+[-+]/gi;
const GIT_WORD = /(?<![\w-])git(?![\w-])/i;
const blank = (text, from, to) => text.slice(0, from) + ' '.repeat(to - from) + text.slice(to);

function blankVariableReads(text) {
  let out = text;
  for (const m of text.matchAll(ENV_VARIABLE)) {
    const end = m.index + m[0].length;
    if (!ASSIGNS_AFTER.test(text.slice(end))) out = blank(out, m.index, end);
  }
  return out;
}

const plain = (segment) => !GROUPING.test(segment) && !VARIABLE_PARAM.test(segment) && !/=/.test(segment.replace(/^\s*\$\w+\s*=/, ''));

// A pipeline that reads the Env: drive may only end in a sink that cannot write to it: Set-Item fed from the pipe would change
// the variable the read named.
function readsOnly(parts, from) {
  if (!READ_SEGMENT.test(parts[from]) || !plain(parts[from])) return false;
  for (let i = from + 1; parts[i] === '|'; i += 2) {
    if (!SINK_SEGMENT.test(parts[i + 1] ?? '') || !plain(parts[i + 1])) return false;
  }
  return true;
}

function blankDriveReads(text) {
  const parts = text.split(SEGMENT_BREAKS);
  return parts.map((segment, i) => (/env:/i.test(segment) && readsOnly(parts, i) ? segment.replace(LITERAL_DRIVE_REF, (ref) => ' '.repeat(ref.length)) : segment)).join('');
}

// A literal read call is a read only when nothing in the rest of its segment assigns (`...GetEnvironmentVariables()["x"] = 1`).
function blankGetCalls(text) {
  let out = text;
  for (const m of text.matchAll(LITERAL_GET_CALL)) {
    const end = m.index + m[0].length;
    const tail = text.slice(end).split(/[;|&\n]/)[0];
    if (!tail.includes('=')) out = blank(out, m.index, end);
  }
  return out;
}

export function environmentChanges(text) {
  const remaining = blankGetCalls(blankDriveReads(blankVariableReads(String(text || '')))).replace(/['"`\\]/g, '');
  return [...remaining.matchAll(MENTION)].map((m) => ({ index: m.index, end: m.index + m[0].length, text: remaining }));
}

export const environmentChangeBeforeGit = (text) => environmentChanges(text).some((change) => GIT_WORD.test(change.text.slice(change.end)));
