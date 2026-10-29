// Test fixture (KIT-T705): the shapes that hide `target` from a quote-pairing shell split, so a gate
// that reads each segment's first word never sees it, while a real shell still runs it.
//
//   hiddenBehindQuotes(target) -> string[]
//     [0] a backslash-escaped double quote opens no string in bash, but a pairing split opens one
//     [1] a $'…' string with an escaped quote ends where a pairing split thinks it continues

export const hiddenBehindQuotes = (target) => [
  `echo \\" ; ${target} ; echo \\"`,
  `echo $'a\\'' ; ${target} ; echo $'\\''`,
];
