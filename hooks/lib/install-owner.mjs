// install-owner.mjs — which `install` words of one command a known non-copying command positively owns.
//
//   unownedInstalls(words) -> number
//     how many `install` words of `words` (one command's words, grouping characters cut) the shell may run as the coreutils
//     copy: the one leading the command, and every other one no owner below claims. An unknown command before `install`
//     (`frobnicate install a b`, `docker run --rm npm install a b`, `chroot npm install a b`) owns nothing.
//
// Owners: a package manager whose own subcommand is `install` (`npm --prefix app install`, `cargo install`, `rustup toolchain
// install`, `dotnet tool install`, `nix profile install`); a build tool, `install` being one of its targets (`make install`,
// `ninja -C build install`, `meson install`, `cmake --build . --target install`); git, whose words are text. The owner is the
// command a strict walk finds past wrappers (`sudo`, `fakeroot`, `chroot DIR`, `wsl -d Ubuntu --`).

import { commandName, commandWordIndex, leadIndex } from './command-lead.mjs';

const INSTALL = /^install$/i;
const MANAGER = /^(?:npm|pnpm|yarn|bun|cargo|pip3?|pipx|uv|poetry|gem|bundle|brew|apt(?:-get)?|dnf|yum|apk|choco|winget|scoop|go|composer|nuget|mix|pacman|zypper|snap|flatpak|port)$/i;
const SUBCOMMAND_PATHS = { dotnet: [['tool']], rustup: [['toolchain']], nix: [['profile']], uv: [[], ['pip']] };
const NO_GROUP = [[]];
const ANYWHERE = /^(?:make|gmake|ninja|meson|cmake|git)$/i;
const OPTION_TAKING_A_VALUE = /^(?:--prefix|--cwd|--dir|--directory|--workspace|--registry|--cache|--userconfig|--manifest-path|--root|--filter|--target-dir|-C|-w|-F|-o)$/;

const OWNER_WALK = {
  extraWrapper: /^(?:busybox|wsl|fakeroot|chroot|strace|flock|nsenter|taskset|parallel)$/i,
  operands: { chroot: { count: 1 }, flock: { count: 1 }, taskset: { count: 1, flagReplaces: true } },
  strict: true,
};

const isInstall = (word) => INSTALL.test(commandName(word));

// The words between a manager and its `install`, without options and the values of the options known to take one.
function subcommandWords(between) {
  const words = [];
  for (let i = 0; i < between.length; i++) {
    if (!between[i].startsWith('-')) words.push(between[i].toLowerCase());
    else if (OPTION_TAKING_A_VALUE.test(between[i])) i++;
  }
  return words;
}

const sameWords = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);

function owns(owner, between) {
  const name = commandName(owner);
  if (ANYWHERE.test(name)) return true;
  const paths = SUBCOMMAND_PATHS[name.toLowerCase()] || (MANAGER.test(name) ? NO_GROUP : []);
  const sub = subcommandWords(between);
  return paths.some((path) => sameWords(path, sub));
}

/** Whether the `install` word at `at` is an argument of the command a strict walk finds before it, and that command owns it. */
function owned(words, at) {
  const lead = commandWordIndex(words, OWNER_WALK);
  return lead >= 0 && lead < at && owns(words[lead], words.slice(lead + 1, at));
}

export function unownedInstalls(words) {
  const leading = leadIndex(words, (name) => INSTALL.test(name), OWNER_WALK);
  return words.filter((word, i) => isInstall(word) && (i === leading || !owned(words, i))).length;
}
