#!/usr/bin/env node
// shell-write-scan-printers.test.mjs — echo and printf print their arguments, so a write-tool word inside them is text
// (KIT-T1220); a substitution that runs, or a pipe into a shell, still counts.
// Run: node hooks/shell-write-scan-printers.test.mjs

import { shellSourceWrite } from './lib/shell-source-write.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const hit = (command) => shellSourceWrite(command, { shell: 'bash' });

const PAYLOAD = '{"tool_name":"PowerShell","tool_input":{"command":"Copy-Item -Recurse -Path \\"/c/x y/z\\" -Destination rust\\\\patches\\\\b"}}';
const PRINTS = [
  ['a gate dry run piping a JSON payload that names Copy-Item', `printf '%s' '${PAYLOAD}' | node hooks/source-shell-gate.mjs`],
  ['echo of a single-quoted copy command', "echo 'Copy-Item -Recurse a b'"],
  ['echo of a double-quoted copy command', 'echo "cp a src/b.rs"'],
  ['echo of unquoted words that spell a copy', 'echo cp a src/b.rs'],
  ['printf of a delete command', "printf 'rm src/a.rs\\n'"],
  ['printf with a single-quoted substitution marker', "printf '%s' '$(rm src/a.rs)'"],
];
for (const [name, command] of PRINTS) check(`${name} writes nothing`, hit(command) === null);

const RUNS = [
  ['echo piped into sh', "echo 'cp a src/b.rs' | sh"],
  ['printf piped into bash', "printf 'rm src/a.rs' | bash"],
  ['echo piped into sudo bash', "echo 'cp a src/b.rs' | sudo bash"],
  ['a command substitution inside echo', 'echo "$(cp a src/b.rs)"'],
  ['a backtick substitution inside echo', 'echo `rm src/a.rs`'],
  ['echo of an eval', "eval \"$(echo 'cp a src/b.rs')\""],
  ['a redirect from echo', 'echo x > src/a.rs'],
  ['a write chained after echo', 'echo done; cp a src/b.rs'],
  ['printf teed into a source file', "printf x | tee src/a.rs"],
];
for (const [name, command] of RUNS) check(`${name} still counts`, hit(command) !== null);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
