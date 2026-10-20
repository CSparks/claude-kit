#!/usr/bin/env node
// python-stdin-gate.test.mjs — python that reads stdin is refused only when python resolves to the
// Windows Store stub; scripts, -c, and a real interpreter pass.
// Run: node hooks/python-stdin-gate.test.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isBrokenStdinPython, pythonStdinCommand } from './lib/python-stdin.mjs';

const HOOK = fileURLToPath(new URL('./python-stdin-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const stub = { isStub: () => true };
const real = { isStub: () => false };

for (const cmd of ['python3 -', "python3 - <<'EOF'\nprint(1)\nEOF", 'python <<EOF\nx\nEOF', 'cat x.py | python3', 'echo 1 | python3 -', 'python3 <<< "print(1)"', 'py -']) {
  check(`blocks on the stub: ${cmd.split('\n')[0]}`, pythonStdinCommand(cmd, stub) !== null);
}
for (const cmd of ['python3 script.py', 'python3 -c "print(1)"', 'python3 -m http.server', 'cat x | python3 tool.py', 'node -e "1"', 'echo python3 -', 'ls | grep python']) {
  check(`allows on the stub: ${cmd}`, pythonStdinCommand(cmd, stub) === null);
}
check('allows stdin python when the interpreter is real', pythonStdinCommand('python3 -', real) === null);
check('a non-Windows machine has no broken python', process.platform === 'win32' || isBrokenStdinPython('python3') === false);

const hook = (command) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
check('the hook allows a plain command (exit 0)', hook('ls').status === 0);
check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { input: 'nope', encoding: 'utf8' }).status === 0);
if (process.platform === 'win32' && isBrokenStdinPython('python3')) {
  const r = hook('python3 -');
  check('on this machine python3 hangs on stdin: the hook blocks and names node', r.status === 2 && /node -e/.test(r.stderr), r.stderr);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
