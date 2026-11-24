// shell-lexer-rules.mjs — the per-shell reading rules and the reason names shell-lexer.mjs uses.
//
//   rulesFor(shell, blind) -> the rule set: escape character, quote characters, operators, whether a backtick opens a
//     span, which characters before a quote are ambiguous (`flags`), and the shell's own constructs
//   REASON      the name of every construct the lexer marks
//   AMBIGUOUS   the reasons that make a line's quoting ambiguous, first found by this order
//   TYPOGRAPHIC_QUOTE, readsTypographicQuote(shell)   the Unicode quotes PowerShell reads, and whether `shell` may

export const REASON = Object.freeze({
  dollar: "a $' or $\" string",
  typographic: 'a typographic quote PowerShell reads as a quote',
  escape: 'an escape character before a quote',
  textQuote: 'a single quote cmd reads as text',
  unclosed: 'a quote that never closes',
  quoteInSubstitution: 'a quote inside a substitution inside double quotes',
  hereString: 'a PowerShell here-string under a shell that may not read one',
  quotedSubstitution: 'a substitution inside double quotes',
  groupComment: 'a comment or heredoc inside a group',
  caseStatement: 'a case statement',
  unclosedSubstitution: 'a substitution that never closes',
  unknownEscape: 'an escape character of an unknown shell',
});

// A case statement counts only where a command starts (its mark carries `command: true`). A comment or heredoc inside a
// group is read to its line end or terminator, so it only marks the text for a cut.
export const AMBIGUOUS = [REASON.dollar, REASON.typographic, REASON.escape, REASON.textQuote, REASON.unclosed,
  REASON.quoteInSubstitution, REASON.hereString, REASON.unclosedSubstitution, REASON.caseStatement];

// The Unicode single and double quotes PowerShell reads as quote characters (U+2018 to U+201B, U+201C to U+201E).
export const TYPOGRAPHIC_QUOTE = /[‘-„]/;

/** True when a typographic quote may be a quote: PowerShell reads it as one, and a caller that does not know its shell must assume so. */
export const readsTypographicQuote = (shell) => shell === 'powershell' || !shell;

const RULES = {
  bash: { escape: '\\', quotes: `"'`, inDouble: true, backtick: true, subs: true, ops: ';|&\n', flags: '`', ansi: true },
  powershell: { escape: '`', quotes: `"'`, inDouble: true, subs: true, ops: ';|&\n', flags: '`\\', doubled: true, hereStrings: true, blockComments: true },
  cmd: { escape: '^', quotes: '"', ops: '|&\n', flags: '`', textQuote: "'" },
};
const UNKNOWN = { quotes: `"'`, backtick: true, subs: true, ops: ';|&\n', legacy: true, hereStrings: true, markHereStrings: true, blockComments: true };
const BLIND = { quotes: '', ops: ';|&\n', separators: `"'\`()<>` };

export const rulesFor = (shell, blind) => (blind ? BLIND : RULES[shell] || UNKNOWN);
