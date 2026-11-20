#!/usr/bin/env node
// source-shell-gate-package-install.test.mjs — a package manager's `install` subcommand, alone or inside a container's
// `sh -c "..."`, writes no file by hand and passes; the coreutils `install` and a real redirect still block (KIT-T1446).
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
    ['an ssh npm install', 'ssh host "cd app && npm install next@16"'],
  ];
  for (const [name, command] of passes) ok(`source gate passes ${name}`, src(command) === PASS);
  ok('ambiguous quoting: source gate passes npm install', src(`${AMBIGUOUS}npm install next@^16.4.6 2>&1 | tail -5`) === PASS);

  const blocks = [
    ['coreutils install of a source file', 'install -m 755 a.sh src/b.rs'],
    ['coreutils install after an npm segment', 'npm -v && install a.sh src/b.rs'],
    ['coreutils install after an npm call in a container body', 'docker run --rm node sh -c "npm -v && install a.sh src/b.rs"'],
    ['coreutils install after npm and a semicolon', 'npm run build; install a.sh src/b.rs'],
    ['an npm install redirected into a source file', 'npm install x@1 > src/b.rs'],
    ['an npm segment then a redirect', 'npm install x@1 && echo y > src/b.rs'],
  ];
  for (const [name, command] of blocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);
  ok('ambiguous quoting: source gate blocks a coreutils install', src(`${AMBIGUOUS}install a.sh src/b.rs`) === BLOCK);
  ok('ambiguous quoting: source gate blocks install after an npm segment', src(`${AMBIGUOUS}npm -v && install a.sh src/b.rs`) === BLOCK);
} finally {
  finish();
}
