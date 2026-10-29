#!/usr/bin/env node
// python-stdin-gate.test.mjs (KIT-T699) — python that reads its program from an empty or absent stdin is
// refused on Windows; a non-empty heredoc, a pipe, `< file`, scripts and `-c` pass.
// Run: node hooks/python-stdin-gate.test.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pythonStdinCommand } from './lib/python-stdin.mjs';
import { heredocAfter } from './lib/heredoc.mjs';

const HOOK = fileURLToPath(new URL('./python-stdin-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const win = { isStub: () => false, platform: 'win32' };
const reason = (cmd, opts = win) => pythonStdinCommand(cmd, opts)?.reason ?? null;
const first = (cmd) => cmd.split('\n')[0];

const EMPTY_FALLBACK = "python - <<'EOF' 2>/dev/null || node -e '\nconsole.log(1)\n'\nEOF";
const blocked = [
  [EMPTY_FALLBACK, 'empty-heredoc'],
  ["python <<'EOF'\nEOF", 'empty-heredoc'],
  ["python3 - <<EOF\n\nEOF", 'empty-heredoc'],
  ['python - 2>/dev/null', 'no-stdin'],
  ['python3 -', 'no-stdin'],
  ['python', 'no-stdin'],
  ['python3.14 - 2>&1', 'no-stdin'],
  ['/c/Python314/python.exe -', 'no-stdin'],
  ['C:\\Python314\\python.exe -', 'no-stdin'],
  ['py -3', 'no-stdin'],
  ['env PYTHONUTF8=1 python -', 'no-stdin'],
  ['timeout 5 python3 -', 'no-stdin'],
  ["exec python - <<'EOF'\nEOF", 'empty-heredoc'],
  ['cd x && command python3 -u -', 'no-stdin'],
];
for (const [cmd, why] of blocked) check(`blocks (${why}): ${first(cmd)}`, reason(cmd) === why, JSON.stringify(reason(cmd)));

const allowed = [
  "python - <<'EOF'\nprint(1)\nEOF",
  'python3 <<EOF\nprint(1)\nEOF',
  'python3 script.py',
  'python x.py 2>/dev/null',
  'python -c "print(1)"',
  'python3 -m http.server',
  'cat f | python3 -',
  'echo 1 | python3',
  'python - < script.py',
  'python3 <<< "print(1)"',
  'python --version',
  'py -3 script.py',
  'node -e "1"',
  'echo python3 -',
  'ls | grep python',
  "cat > notes.md <<'EOF'\nrun: python -\nEOF",
];
for (const cmd of allowed) check(`allows: ${first(cmd)}`, reason(cmd) === null, JSON.stringify(reason(cmd)));

check('negative control: the empty-heredoc shape passes off Windows', reason(EMPTY_FALLBACK, { isStub: () => false, platform: 'linux' }) === null);
check('the Microsoft Store stub still blocks a non-empty heredoc', reason("python3 - <<'EOF'\nprint(1)\nEOF", { isStub: () => true, platform: 'win32' }) === 'store-stub');
check('a real interpreter does not trip the stub check', reason('cat f | python3 -', win) === null);

const h = heredocAfter("cat <<-'END'\n\tline\n\tEND\nafter", 0);
check('heredocAfter reads a <<- body up to its terminator', h && h.body === '\tline' && h.delimiter === 'END');
check('heredocAfter skips a here-string', heredocAfter('x <<< "y"', 0) === null);

const hook = (command) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
check('the hook allows a plain command (exit 0)', hook('ls').status === 0);
check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { input: 'nope', encoding: 'utf8' }).status === 0);
if (process.platform === 'win32') {
  const r = hook(EMPTY_FALLBACK);
  check('on Windows the hook blocks the empty-heredoc shape and names node', r.status === 2 && /node -e/.test(r.stderr) && /python-stdin/.test(r.stderr), r.stderr);
  check('on Windows the hook allows a non-empty heredoc', hook("python3 - <<'EOF'\nprint(1)\nEOF").status === 0);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
