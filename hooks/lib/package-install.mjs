// The `install` subcommand of a package manager (`npm install x@1`, `sudo apt-get -y install foo`, `cargo install t`) is the
// manager's own work, not the coreutils `install` that copies a file to a destination. `rustup toolchain install v` counts: its
// `install` sits one level below the `toolchain` group.
//
//   everyInstallIsPackaged(text, words, shell) -> boolean
//     true when `words` (the words of the segment `text`) hold `install` words and a package manager leads a command, past
//     wrappers, for each of them: in the segment itself, in the string a shell, ssh, find -exec or trap runs (also behind
//     `docker run ... sh -c`), or in a substitution. A manager named as an option value, a later operand or an assignment
//     value leads nothing.
//   blankPackageInstall(piece) -> string
//     one blind segment (quote pairing untrusted) with its first `install` word blanked when a package manager leads the
//     piece and that word is the manager's subcommand.

import { commandName, leadIndex } from './command-lead.mjs';
import { MAX_NESTING, cleaned, commandTokens, substitutions, withoutRedirects } from './lead-command-walk.mjs';
import { runnerTexts } from './runner-texts.mjs';
import { segments, shellArgs } from './shell-segments.mjs';

const MANAGER = /^(?:npm|pnpm|yarn|bun|npx|cargo|pip3?|pipx|uv|poetry|gem|bundle|brew|apt(?:-get)?|dnf|yum|apk|choco|winget|scoop|go|composer|dotnet|nuget|mix|pacman|zypper|snap|flatpak)$/i;
const TOOLCHAIN_MANAGER = /^rustup$/i;
const TOOLCHAIN_GROUP = /^toolchain$/i;
const INSTALL = /^install$/i;
const INSTALL_WORD = /(?<![\w.-])install(?![\w.-])/i;
const OPTION_TAKING_A_VALUE = /^(?:--prefix|--cwd|--dir|--directory|--workspace|--registry|--cache|--userconfig|--manifest-path|--root|--filter|--target-dir|-C|-w|-F)$/;
const WRAPPER_VALUE_FLAG = /^-[A-Za-z]$/;
const WRAPPER_BOOLEAN_FLAG = /^-[EHSn]$/;
const BLIND_SEPARATOR = /[\s"'`]+/;

// The index in `rest` (the manager's words after its name) of the subcommand: the first word that is no option and no value
// of a known option that takes one.
function subcommandAt(rest) {
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('-')) return i;
    if (OPTION_TAKING_A_VALUE.test(rest[i])) i++;
  }
  return -1;
}

// `sudo -u npm install ...` names a user, not the manager: a short wrapper flag that takes a value stands directly before the name.
const valueOfWrapperFlag = (lead) => {
  const last = lead[lead.length - 1] || '';
  return WRAPPER_VALUE_FLAG.test(last) && !WRAPPER_BOOLEAN_FLAG.test(last);
};

// The index in `words` of the `install` that the package manager leading `words` owns, or -1.
function ownedInstallAt(words) {
  const at = leadIndex(words, (name) => MANAGER.test(name) || TOOLCHAIN_MANAGER.test(name));
  if (at < 0 || valueOfWrapperFlag(words.slice(0, at))) return -1;
  const rest = words.slice(at + 1);
  let sub = subcommandAt(rest);
  if (sub >= 0 && TOOLCHAIN_MANAGER.test(commandName(words[at])) && TOOLCHAIN_GROUP.test(rest[sub])) {
    const next = subcommandAt(rest.slice(sub + 1));
    sub = next < 0 ? -1 : sub + 1 + next;
  }
  return sub >= 0 && INSTALL.test(rest[sub]) ? at + 1 + sub : -1;
}

function ownedInstalls(text, shell, depth = 0) {
  let owned = 0;
  for (const seg of segments(text, { shell })) {
    if (ownedInstallAt(cleaned(shellArgs(withoutRedirects(seg.text)))) >= 0) owned++;
    if (depth >= MAX_NESTING) continue;
    const tokens = cleaned(commandTokens(seg.text));
    const runs = [
      ...tokens.flatMap((token, i) => runnerTexts(commandName(token), tokens.slice(i + 1), { shell })),
      ...substitutions(seg.text, shell).map((inner) => ({ text: inner, shell })),
    ];
    for (const run of runs) owned += ownedInstalls(run.text, run.shell, depth + 1);
  }
  return owned;
}

export function everyInstallIsPackaged(text, words, shell) {
  const installs = words.filter((word) => INSTALL.test(word)).length;
  return installs > 0 && ownedInstalls(text, shell) >= installs;
}

export function blankPackageInstall(piece) {
  const text = String(piece);
  const words = cleaned(text.split(BLIND_SEPARATOR));
  const at = ownedInstallAt(words);
  return at >= 0 && words.findIndex((word) => INSTALL.test(word)) === at ? text.replace(INSTALL_WORD, ' ') : text;
}
