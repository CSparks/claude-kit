// `install` is the coreutils copy unless a known non-copying command positively owns it (install-owner.mjs): a package
// manager's subcommand (`npm install x@1`, `rustup toolchain install v`), a build tool's target (`make install`,
// `ninja -C build install`). Any other command word before it (`frobnicate install a b`, `docker run --rm npm install a b`)
// leaves it a copy.
//
//   leadsNoInstall(text, shell) -> boolean
//     true when every `install` word of the segment `text` is owned: in the segment itself, in the string a shell, ssh,
//     find -exec or trap runs (also behind `docker run ... sh -c`), in a substitution.
//   blankArgumentInstall(piece) -> string
//     one blind segment (quote pairing untrusted) with every `install` word blanked when an owner holds each of them; the
//     piece is cut at every substitution, group and brace opener first, so each starts its own command.

import { commandName } from './command-lead.mjs';
import { installWordCount, ownerLeadIndex, unownedInstalls } from './install-owner.mjs';
import { MAX_NESTING, cleaned, commandTokens, substitutions } from './lead-command-walk.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { words } from './shell-lexer.mjs';
import { blindSegments, segments } from './shell-segments.mjs';

const INSTALL_WORD = /\binstall\b/gi;
const BLIND_COMMAND_START = /\$\(|[<>]\(|[`(){}]/;

// One segment's command words as the shell reads them (escapes resolved), redirections and their targets left out.
const commandWords = (text, shell) => cleaned(words(text, { shell }).filter((word) => !word.redirect).map((word) => word.value));

function countUnowned(text, shell, depth = 0) {
  let unowned = 0;
  for (const seg of segments(text, { shell })) {
    unowned += unownedInstalls(commandWords(seg.text, shell));
    if (depth >= MAX_NESTING) continue;
    const tokens = cleaned(commandTokens(seg.text));
    const runs = [
      ...tokens.flatMap((token, i) => runnerTexts(commandName(token), tokens.slice(i + 1), { shell })),
      ...substitutions(seg.text, shell).map((inner) => ({ text: inner, shell })),
    ];
    for (const run of runs) unowned += countUnowned(run.text, run.shell, depth + 1);
  }
  return unowned;
}

const AFTER_REDIRECT = /[<>][&|]?\s*$/;

// The blind words without the one a redirection names (`<npm` reads a file named npm; it owns nothing).
const blindWords = (text) => {
  const source = String(text);
  return cleaned(words(source, { blind: true }).filter((word) => !AFTER_REDIRECT.test(source.slice(0, word.start))).map((word) => word.raw));
};

// The command word and everything after it is the command's own: the first runner the owner walk can reach, never a word
// it skipped as a wrapper option's value or an operand.
function blindRunner(words, runs) {
  const lead = ownerLeadIndex(words);
  if (lead < 0) return -1;
  return words.findIndex((word, i) => i >= lead && runs(i).length > 0);
}

function countBlindUnowned(piece, depth = 0) {
  let unowned = 0;
  for (const part of String(piece).split(BLIND_COMMAND_START)) {
    const words = blindWords(part);
    const runs = (i) => runnerTexts(commandName(words[i]), words.slice(i + 1), { blind: true });
    const runner = depth < MAX_NESTING ? blindRunner(words, runs) : -1;
    if (runner < 0) {
      unowned += unownedInstalls(words);
      continue;
    }
    const nested = runs(runner);
    const covered = nested.reduce((sum, run) => sum + installWordCount(blindWords(run.text)), 0);
    unowned += unownedInstalls(words.slice(0, runner + 1));
    unowned += Math.max(0, installWordCount(words.slice(runner + 1)) - covered);
    for (const run of nested) {
      for (const seg of blindSegments(run.text)) unowned += countBlindUnowned(seg.text, depth + 1);
    }
  }
  return unowned;
}

export const leadsNoInstall = (text, shell) => countUnowned(text, shell) === 0;

export function blankArgumentInstall(piece) {
  const text = String(piece);
  return countBlindUnowned(text) === 0 ? text.replace(INSTALL_WORD, ' ') : text;
}
