// The path argument of each filesystem write call in node, python or .NET code.
//
//   scriptWriteTargets(code) -> (string | null)[]
//     one entry per write call target: the literal path when the argument is a quoted string,
//     null when it is anything else (a variable, a concatenation, a call): the caller cannot know
//     where such a write lands and must fail closed. A call that moves or copies yields two entries.

const LITERAL = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|\`([^\`\\$\n]*)\`)`;
const LITERAL_ARG = new RegExp(String.raw`\s*${LITERAL}\s*(?=[,)])`, 'y');
const COMMA = /\s*,/y;

const JS_WRITE = new RegExp(
  String.raw`\b(?:(?:fs|fsp|promises)\.(?:promises\.)?(?:rename|rm|rmdir|cp|copyFile)|(?:rename|rm|rmdir|cp|copyFile|symlink|link)Sync|(?:writeFile|appendFile|unlink|truncate|createWriteStream|outputFile)(?:Sync)?|WriteAll(?:Text|Lines|Bytes))\s*\(`,
  'g',
);
const PY_WRITE = /\b(?:os\.(?:remove|unlink|rename|replace|rmdir|removedirs)|shutil\.(?:move|copy|copy2|copyfile|copytree|rmtree))\s*\(/g;
const PY_OPEN = /\bopen\s*\(/g;
const PY_OPEN_MODE = /\s*,\s*(?:mode\s*=\s*)?['"][rbtU]*[wax+]/y;
const PY_PATH_METHOD = /\.(?:write_text|write_bytes|unlink|touch|rename|replace|rmdir)\s*\(/g;
const PY_PATH_LITERAL = new RegExp(String.raw`\bPath\(\s*${LITERAL}\s*\)$`);
const TWO_TARGETS = /\b(?:rename|replace|move|copy2?|copyfile|copytree|cp|copyFile|symlink|link)(?:Sync)?\s*\($/;

const literalAt = (code, from) => {
  LITERAL_ARG.lastIndex = from;
  const m = LITERAL_ARG.exec(code);
  if (!m) return null;
  const value = (m[1] ?? m[2] ?? m[3]).replace(/\\\\/g, '\\');
  return { value, end: LITERAL_ARG.lastIndex };
};

function callTargets(code, from, count) {
  const first = literalAt(code, from);
  if (!first) return [null];
  if (count === 1) return [first.value];
  COMMA.lastIndex = first.end;
  if (!COMMA.test(code)) return [first.value, null];
  const second = literalAt(code, COMMA.lastIndex);
  return [first.value, second ? second.value : null];
}

function pythonOpenTargets(code) {
  const out = [];
  for (const m of code.matchAll(PY_OPEN)) {
    const first = literalAt(code, m.index + m[0].length);
    PY_OPEN_MODE.lastIndex = first ? first.end : m.index + m[0].length;
    const writes = first ? PY_OPEN_MODE.test(code) : /^[^\n]{0,300}?,\s*(?:mode\s*=\s*)?['"][rbtU]*[wax+]/.test(code.slice(m.index + m[0].length));
    if (writes) out.push(first ? first.value : null);
  }
  return out;
}

function pathMethodTargets(code) {
  const out = [];
  for (const m of code.matchAll(PY_PATH_METHOD)) {
    const recv = PY_PATH_LITERAL.exec(code.slice(0, m.index));
    out.push(recv ? (recv[1] ?? recv[2] ?? recv[3]) : null);
  }
  return out;
}

export function scriptWriteTargets(code) {
  const text = String(code || '');
  const out = [];
  for (const m of [...text.matchAll(JS_WRITE), ...text.matchAll(PY_WRITE)]) {
    const end = m.index + m[0].length;
    out.push(...callTargets(text, end, TWO_TARGETS.test(text.slice(0, end)) ? 2 : 1));
  }
  out.push(...pythonOpenTargets(text), ...pathMethodTargets(text));
  return out;
}
