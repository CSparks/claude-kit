// awk-program.mjs — the program text and file operands of an awk-family call (awk, gawk, mawk, nawk), and the regex its
// patterns select lines by (KIT-T1617). The one-file-search gate judges an awk over a named file with them.
//
//   AWK_FAMILY                -> the tool names that run an awk program
//   awkTool(name) -> 'awk' for any of them, else name unchanged
//   awkArgs(argv) -> { program, files } | null   null when the program comes from a file (-f)
//   awkRegex(program) -> the first regex a pattern (outside every { action }) matches lines by, or null

export const AWK_FAMILY = /^(?:awk|gawk|mawk|nawk)$/;
export const awkTool = (name) => (AWK_FAMILY.test(name) ? 'awk' : name);

const VALUE_FLAG = /^(?:-[Fv]|--field-separator|--assign)$/;
const PROGRAM_FILE = /^-[A-Za-z]*f$|^--file\b|^-f/;
const unquote = (a) => a.replace(/^["']|["']$/g, '');

export function awkArgs(argv) {
  const positionals = [];
  let flagsEnded = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!flagsEnded && a === '--') { flagsEnded = true; continue; }
    if (flagsEnded || !a.startsWith('-') || a === '-') { positionals.push(unquote(a)); continue; }
    if (PROGRAM_FILE.test(a)) return null;
    if (VALUE_FLAG.test(a)) i++;
  }
  const [program = '', ...files] = positionals;
  return { program, files };
}

const STRING = /"(?:[^"\\]|\\.)*"/g;
const REGEX_LITERAL = /\/((?:[^/\\\n]|\\.)+)\//;

// The program with its string literals and every brace-balanced action removed: what is left is its patterns.
function patternText(program) {
  let depth = 0;
  let out = '';
  for (const ch of program.replace(STRING, '""')) {
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

export function awkRegex(program) {
  const m = REGEX_LITERAL.exec(patternText(program));
  return m ? m[1] : null;
}
