// The `install` subcommand of a package manager (`npm install x@1`, `sudo apt-get -y install foo`, `cargo install t`)
// is the manager's own work, not the coreutils `install` that copies a file to a destination.
// A manager name, then any words up to the next command separator, then `install`.

const MANAGERS = 'npm|pnpm|yarn|bun|npx|cargo|pip3?|pipx|uv|poetry|gem|bundle|brew|apt(?:-get)?|dnf|yum|apk|choco|winget|scoop|go|composer|dotnet|nuget|mix|pacman|zypper|snap|flatpak';
const MANAGER_INSTALL = new RegExp(String.raw`(?<![\w.-])(?:${MANAGERS})(?:\.cmd|\.exe)?(?![\w.-])[^;&|\n(\x60]*?(?<![\w.-])install(?![\w.-])`, 'gi');
const INSTALL_WORD = 'install'.length;

/** The text index of every `install` word that a package manager of the same command owns. */
export function packageInstallIndexes(text) {
  return new Set([...String(text).matchAll(MANAGER_INSTALL)].map((m) => m.index + m[0].length - INSTALL_WORD));
}

/** `text` with the package-manager `install` words blanked, for a scan that tests the word anywhere. */
export function withoutPackageInstalls(text) {
  return String(text).replace(MANAGER_INSTALL, (m) => m.slice(0, -INSTALL_WORD));
}
