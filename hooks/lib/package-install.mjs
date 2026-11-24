// `install` is the coreutils copy only where a shell takes it as a command: the start of a segment, past wrappers (`sudo`,
// `env`, `command`, `timeout 5`), assignments and grouping words. The word as an argument of any other command is that
// command's own subcommand or target (`npm install x@1`, `ninja -C build install`, `make install`, `cmake --install build`,
// `rustup toolchain install v`) and writes no file by hand.
//
//   leadsNoInstall(text, shell) -> boolean
//     true when no `install` leads a command in the segment `text`: not in the segment itself, not in the string a shell,
//     ssh, find -exec or trap runs (also behind `docker run ... sh -c`), not in a substitution.
//   blankArgumentInstall(piece) -> string
//     one blind segment (quote pairing untrusted) with every `install` word blanked when none of them leads a command.

import { commandName, leadIndex } from './command-lead.mjs';
import { MAX_NESTING, cleaned, commandTokens, substitutions, withoutRedirects } from './lead-command-walk.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { blindSegments, segments, shellArgs } from './shell-segments.mjs';

const INSTALL = /^install$/i;
const INSTALL_WORD = /\binstall\b/gi;
const BLIND_SEPARATOR = /[\s"'`]+/;

const leadsAnInstall = (words) => leadIndex(words, (name) => INSTALL.test(name)) >= 0;

function leadingInstalls(text, shell, depth = 0) {
  let leading = 0;
  for (const seg of segments(text, { shell })) {
    if (leadsAnInstall(cleaned(shellArgs(withoutRedirects(seg.text))))) leading++;
    if (depth >= MAX_NESTING) continue;
    const tokens = cleaned(commandTokens(seg.text));
    const runs = [
      ...tokens.flatMap((token, i) => runnerTexts(commandName(token), tokens.slice(i + 1), { shell })),
      ...substitutions(seg.text, shell).map((inner) => ({ text: inner, shell })),
    ];
    for (const run of runs) leading += leadingInstalls(run.text, run.shell, depth + 1);
  }
  return leading;
}

function leadingBlindInstalls(piece, depth = 0) {
  const words = cleaned(String(piece).split(BLIND_SEPARATOR));
  let leading = leadsAnInstall(words) ? 1 : 0;
  if (depth >= MAX_NESTING) return leading;
  for (let i = 0; i < words.length; i++) {
    for (const run of runnerTexts(commandName(words[i]), words.slice(i + 1), { blind: true })) {
      for (const seg of blindSegments(run.text)) leading += leadingBlindInstalls(seg.text, depth + 1);
    }
  }
  return leading;
}

export const leadsNoInstall = (text, shell) => leadingInstalls(text, shell) === 0;

export function blankArgumentInstall(piece) {
  const text = String(piece);
  return leadingBlindInstalls(text) === 0 ? text.replace(INSTALL_WORD, ' ') : text;
}
