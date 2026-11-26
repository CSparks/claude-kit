// The magic-number literal rule of hooks/pre-write.mjs. A literal is trivial when its VALUE is
// 0, 1 or 2, optionally signed, in integer or float spelling (2, 2.0, -1.0; an f/F/u/l suffix is
// ignored). Everything else is magic: other values, exponent forms (1e3), hex and binary.

const LITERAL = /[^A-Za-z0-9_.](-?)(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
const TRIVIAL_VALUE = /^[012](?:\.0+)?$/;
// A literal NAMED at its use site: the value of a key or an assignment (`retries: 3`, `opts.timeout = 5000`,
// `sizes: [12, 14]`). Comparisons (`==`, `<=`, `!=`) are not names.
const NAMED_VALUE = /([A-Za-z_$][\w$.\])]*\s*(?<![=!<>])[:=](?!=)\s*)(?:-?\.?\d[\w.]*|\[[\s\d.,_-]*\])/g;

// The first magic numeric literal of a code line, or null when every literal on it is trivial (KIT-T1602).
export function firstMagicLiteral(code) {
  for (const m of code.matchAll(LITERAL)) {
    const digits = m[2].replace(/_/g, '');
    if (!TRIVIAL_VALUE.test(digits)) return m[1] + digits;
  }
  return null;
}

// A declaration names its value: the keyword is read from the code with strings blanked, and a name follows it, so
// `"var(--color-x)"` in a string is no declaration (KIT-T1602).
const DECLARATION = /\b(?:const|constexpr|let|var|final|enum|static|readonly)\s+[A-Za-z_$[{]/;
export const isDeclaration = (raw, code) => DECLARATION.test(code) || /^\s*#define\b/.test(raw);

// The code line with every named literal cut, so the rest of the line is still judged: a key-value row that also
// carries `<Icon size={14} />` keeps the 14 (KIT-T1602).
export const cutNamedLiterals = (code) => code.replace(NAMED_VALUE, '$1_');

export const MAGIC_NUMBER_RULE = 'allowed bare: 0, 1, 2 and their signed or float spellings (-1, 2.0, 1.0f)';
