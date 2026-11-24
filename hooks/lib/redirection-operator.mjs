// redirection-operator.mjs — whether a `|` or `&` is a character of a redirection operator rather than a command boundary.
//
//   belongsToRedirection(text, i) -> boolean
//     true for the `|` of `>|` and the `&` of `>&`, `<&`, `&>` and `&>>` (an fd-number prefix, as in `2>&1`, ends in one of
//     them); false for every other `|` and `&`. Shared by the segment splitter and the delete operand cut so the two read
//     a redirection the same way.

export function belongsToRedirection(text, i) {
  const before = text[i - 1];
  if (text[i] === '|') return before === '>';
  return text[i] === '&' && (before === '>' || before === '<' || text[i + 1] === '>');
}
