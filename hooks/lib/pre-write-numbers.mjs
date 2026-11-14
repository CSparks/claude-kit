// The magic-number literal rule of hooks/pre-write.mjs. A literal is trivial when its VALUE is
// 0, 1 or 2, optionally signed, in integer or float spelling (2, 2.0, -1.0; an f/F/u/l suffix is
// ignored). Everything else is magic: other values, exponent forms (1e3), hex and binary.

const LITERAL = /[^A-Za-z0-9_.](-?)(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)/;
const TRIVIAL_VALUE = /^[012](?:\.0+)?$/;

// The first numeric literal of a code line, or null when it is absent or trivial.
export function firstMagicLiteral(code) {
  const m = LITERAL.exec(code);
  if (!m) return null;
  const sign = m[1];
  const digits = m[2].replace(/_/g, '');
  return TRIVIAL_VALUE.test(digits) ? null : sign + digits;
}

export const MAGIC_NUMBER_RULE = 'allowed bare: 0, 1, 2 and their signed or float spellings (-1, 2.0, 1.0f)';
