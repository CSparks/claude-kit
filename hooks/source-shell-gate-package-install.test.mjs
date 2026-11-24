#!/usr/bin/env node
// source-shell-gate-package-install.test.mjs — an `install` that is an argument of another command (a package manager's
// subcommand, a build tool's target), alone or inside a container's `sh -c "..."`, writes no file by hand and passes; the
// coreutils `install` leading a command and a real redirect still block (KIT-T1446, KIT-T1521).
// Run: node hooks/source-shell-gate-package-install.test.mjs

import { AMBIGUOUS, BLOCK, PASS, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, finish } = wrappedHarness('source-shell-gate-package-install');

try {
  const reported = 'W=$(pwd -W) && for a in clinical-rx skini-inc; do MSYS_NO_PATHCONV=1 docker run --rm -v "$W/$a:/app" -w /app node:22-alpine sh -c "npm -v && npm install next@^16.4.6 --package-lock-only --no-audit --no-fund 2>&1 | tail -5"; done; git diff --stat -- clinical-rx skini-inc';
  const passes = [
    ['the reported docker npm install', reported],
    ['npm install of a versioned spec', 'npm install next@^16.4.6 --package-lock-only'],
    ['npm install with an fd-dup into a pipe', 'npm install next@^16.4.6 2>&1 | tail -5'],
    ['npm with options before install', 'npm --prefix app --no-audit install next@^16.4.6'],
    ['npm.cmd install', 'npm.cmd install left-pad@1'],
    ['a container sh -c npm install', 'docker run --rm node sh -c "npm i x && npm install next@16"'],
    ['pnpm install', 'pnpm install'],
    ['cargo install', 'cargo install ripgrep'],
    ['pip install', 'pip install requests'],
    ['sudo apt-get install', 'sudo apt-get -y install foo'],
    ['an npm install past wrappers', 'sudo -E env CI=1 npm install next@16'],
    ['an npm install past an assignment', 'CI=1 npm install next@16'],
    ['an npm install in a substitution', 'echo "$(npm install next@16)"'],
    ['an ssh npm install','ssh host "cd app && npm install next@16"'],
    ['rustup toolchain install of a version', 'rustup toolchain install 1.95.0'],
    ['rustup toolchain install with options', 'rustup toolchain install 1.95.0 --profile minimal -c clippy'],
    ['cargo install with a flag', 'cargo install --locked x'],
    ['apt-get install with a flag', 'apt-get install -y x'],
    ['the reported wsl rustup install', "wsl.exe -d Ubuntu -- bash -c 'rustup toolchain install 1.95.0 --profile minimal -c clippy > /root/rustup.log 2>&1; cat /root/rustup.log'"],
  ];
  const argumentInstalls = [
    ['ninja install target', 'ninja -C build install'],
    ['meson install', 'meson install -C build'],
    ['make install', 'make install'],
    ['make install with a prefix variable', 'make -C build install DESTDIR=out'],
    ['cmake --install', 'cmake --install build'],
    ['cmake --build with the install target', 'cmake --build build --config Release --target install'],
    ['make with a job count and a directory', 'make -j4 -C build install'],
    ['ninja with a job count', 'ninja -C build -j 4 install'],
    ['npm with an attached option value', 'npm --prefix=app install x@1'],
    ['go install', 'go install ./cmd/tool@latest'],
    ['pip install', 'pip install -r requirements.txt'],
    ['gem install', 'gem install bundler'],
    ['brew install', 'brew install ripgrep'],
    ['dotnet tool install', 'dotnet tool install -g dotnet-ef'],
    ['a build tool install behind sudo', 'sudo ninja -C build install'],
    ['a build tool install in a chain', 'ninja -C build && ninja -C build install'],
    ['a build tool install in a container shell body', 'docker run img sh -c "ninja -C build install"'],
    ['make install behind fakeroot', 'fakeroot make install'],
    ['an npm install behind a chroot directory', 'chroot /newroot npm install next@16'],
    ['an npm install behind a flock file', 'flock /tmp/lock npm install next@16'],
    ['an apt-get install behind taskset options', 'taskset -c 0 apt-get install -y x'],
    ['an npm install behind wsl', 'wsl -d Ubuntu -- npm install next@16'],
    ['a go install after an assignment of a substitution', 'X=$(pwd) go install ./cmd/tool@latest'],
  ];
  for (const [name, command] of [...passes, ...argumentInstalls]) ok(`source gate passes ${name}`, src(command) === PASS);
  ok('ambiguous quoting: source gate passes npm install', src(`${AMBIGUOUS}npm install next@^16.4.6 2>&1 | tail -5`) === PASS);
  for (const [name, command] of argumentInstalls) ok(`ambiguous quoting: source gate passes ${name}`, src(AMBIGUOUS + command) === PASS);

  const blocks = [
    ['coreutils install of a source file', 'install -m 755 a.sh src/b.rs'],
    ['a backslash-escaped install (KIT-T1528)', 'in\\stall -m 755 a.sh src/b.rs'],
    ['a backslash-escaped cp (KIT-T1528)', 'c\\p a.sh src/b.rs'],
    ['coreutils install after an npm segment', 'npm -v && install a.sh src/b.rs'],
    ['coreutils install after an npm call in a container body', 'docker run --rm node sh -c "npm -v && install a.sh src/b.rs"'],
    ['coreutils install after npm and a semicolon', 'npm run build; install a.sh src/b.rs'],
    ['an npm install redirected into a source file', 'npm install x@1 > src/b.rs'],
    ['an npm segment then a redirect', 'npm install x@1 && echo y > src/b.rs'],
    ['a manager named as an assignment value', 'FOO=npm install a.sh src/b.rs'],
    ['a manager named as the value of a wrapper flag', 'sudo -u npm install a.sh src/b.rs'],
    ['a manager named as an ssh option value', 'ssh -i npm host install a.sh src/b.rs'],
    ['one npm install beside a coreutils install', 'npm install x@1 && install a.sh src/b.rs'],
    ['coreutils install with a mode and a source file', 'install -m 644 a.rs src/b.rs'],
    ['sudo install of a source file', 'sudo install a.rs src/b.rs'],
    ['sudo with options then install', 'sudo -E -u root install -m 644 a.rs src/b.rs'],
    ['install by its path', '/usr/bin/install a.rs src/b.rs'],
    ['install in a subshell', '(install a.rs src/b.rs)'],
    ['install after a pipe', 'echo x | install a.rs src/b.rs'],
    ['install after ||', 'false || install a.rs src/b.rs'],
    ['install in a find -exec clause', 'find . -name "*.rs" -exec install {} src/b.rs \\;'],
    ['install in a container shell body', 'docker run --rm node sh -c "install a.sh src/b.rs"'],
    ['install in a substitution', 'echo "$(install a.rs src/b.rs)"'],
    ['cp of a source file', 'cp a.rs src/b.rs'],
    ['rustup then a coreutils install', 'rustup toolchain install 1.95.0 && install a.rs src/b.rs'],
    ['rustup toolchain install redirected into a source file', 'rustup toolchain install 1.95.0 > src/b.rs'],
    ['a build tool install redirected into a source file', 'ninja -C build install > src/b.rs'],
    ['make install redirected into a source file', 'make install >> src/b.rs'],
    ['an unknown tool with an install argument', 'frobnicate install a.rs src/b.rs'],
    ['an npm exec install argument', 'npm exec install a.rs src/b.rs'],
    ['a manager named as a later operand', 'foo npm install a.sh src/b.rs'],
    ['a manager named as a container image', 'docker run --rm npm install a.sh src/b.rs'],
    ['a manager as an option value of the container shell body', 'docker run --rm node sh -c "foo --npm npm install a.sh src/b.rs"'],
    ['a rustup subcommand that is not a toolchain install', 'rustup run install a.rs src/b.rs'],
    ['install behind busybox', 'busybox install a.rs src/b.rs'],
    ['install behind fakeroot', 'fakeroot install a.rs src/b.rs'],
    ['install behind chroot', 'chroot /newroot install a.rs src/b.rs'],
    ['a manager in the chroot directory slot', 'chroot npm install a.rs src/b.rs'],
    ['install behind strace', 'strace -o out install a.rs src/b.rs'],
    ['install behind flock', 'flock /tmp/lock install a.rs src/b.rs'],
    ['a manager in the flock file slot', 'flock npm install a.rs src/b.rs'],
    ['install behind nsenter', 'nsenter -t 1 -m install a.rs src/b.rs'],
    ['install behind taskset', 'taskset 0x1 install a.rs src/b.rs'],
    ['a manager in the taskset mask slot', 'taskset npm install a.rs src/b.rs'],
    ['install behind parallel', 'parallel install a.rs src/b.rs'],
    ['install behind wsl', 'wsl -d Ubuntu -- install a.rs src/b.rs'],
    ['install after a substitution inside a manager call', 'npm install $(install a.rs src/b.rs)'],
    ['install after an assignment of a substitution', 'X=$(date +%s) install a.rs src/b.rs'],
    ['install in a group', '{ install a.rs src/b.rs; }'],
  ];
  for (const [name, command] of blocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);
  const blindOpeners = [
    ['a command substitution', 'echo $(install a.rs src/b.rs)'],
    ['a backtick', 'echo `install a.rs src/b.rs`'],
    ['a process substitution', 'cat <(install a.rs src/b.rs)'],
    ['a subshell', '(install a.rs src/b.rs)'],
    ['a brace group', '{ install a.rs src/b.rs; }'],
    ['an assignment of a substitution', 'X=$(pwd) install a.rs src/b.rs'],
    ['an unknown command word', 'frobnicate install a.rs src/b.rs'],
    ['a manager named as a later operand', 'foo npm install a.sh src/b.rs'],
    ['a manager subcommand that is not install', 'npm exec install a.rs src/b.rs'],
    ['an installing wrapper', 'fakeroot install a.rs src/b.rs'],
  ];
  for (const [name, command] of blindOpeners) ok(`ambiguous quoting: source gate blocks install after ${name}`, src(AMBIGUOUS + command) === BLOCK);
  const ambiguousBlocks = [
    ['an assignment value', 'FOO=npm install a.sh src/b.rs'],
    ['a wrapper flag value', 'sudo -u npm install a.sh src/b.rs'],
    ['sudo before install', 'sudo install a.rs src/b.rs'],
  ];
  for (const [name, command] of ambiguousBlocks) ok(`ambiguous quoting: source gate blocks a manager named as ${name}`, src(AMBIGUOUS + command) === BLOCK);
  const ownerForms = [
    ['cmake -E running a command', 'cmake -E env install a.rs src/b.rs'],
    ['cmake --build without the install target', 'cmake --build . install a.rs src/b.rs'],
    ['cmake --build with install after the native-tool separator', 'cmake --build . --target all -- install a.rs src/b.rs'],
    ['meson devenv running a command', 'meson devenv install a.rs src/b.rs'],
    ['env running install', 'env install a.rs src/b.rs'],
    ['pnpm with a workspace-root flag before exec', 'pnpm -w exec install a.rs src/b.rs'],
    ['a manager option that is another manager option', 'cargo --prefix exec install a.rs src/b.rs'],
    ['a value option that took install as its value', 'npm --prefix install a.rs src/b.rs'],
    ['an option the manager does not list', 'apt-get --frobnicate exec install a.rs src/b.rs'],
    ['a name that is an object property', 'constructor install a.rs src/b.rs'],
  ];
  for (const [name, command] of ownerForms) {
    ok(`source gate blocks ${name}`, src(command) === BLOCK);
    ok(`ambiguous quoting: source gate blocks ${name}`, src(AMBIGUOUS + command) === BLOCK);
  }
  const hiddenRunners = [
    ['a wrapper option value taken as ssh', 'sudo -u ssh install a.rs src/b.rs'],
    ['a wrapper option value taken as su', 'sudo -u su install -c a.rs src/b.rs'],
    ['an install behind an owner after a fake ssh runner', 'sudo -u ssh flock npm install a.rs src/b.rs'],
  ];
  for (const [name, command] of hiddenRunners) ok(`ambiguous quoting: source gate blocks install hidden by ${name}`, src(AMBIGUOUS + command) === BLOCK);
  ok('ambiguous quoting: source gate blocks a shell body install', src(`${AMBIGUOUS}sh -c install a.sh src/b.rs`) === BLOCK);
  ok('ambiguous quoting: source gate blocks a build tool install redirected', src(`${AMBIGUOUS}ninja -C build install > src/b.rs`) === BLOCK);
  ok('ambiguous quoting: source gate blocks a coreutils install', src(`${AMBIGUOUS}install a.sh src/b.rs`) === BLOCK);
  ok('ambiguous quoting: source gate blocks install after an npm segment', src(`${AMBIGUOUS}npm -v && install a.sh src/b.rs`) === BLOCK);
} finally {
  finish();
}
