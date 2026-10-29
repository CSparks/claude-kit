// syntax-check.mjs — a script a patch touches must parse before the job queues (KIT-D115 follow-up). A tooling script has
// no cargo target, so no test reads it: a syntax error in one passes every build step and lands.
//
//   scriptSyntaxFailures(cwd, files, { check? }) -> [{ file, cmd, exit, message }]
//     files: the applied plan's Map path -> { text } (text null = deleted). Every .mjs / .cjs / .js file that still exists
//     runs through `node --check`; anything else is not judged. `check(absPath)` -> { status, stderr } (injectable).

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = /\.(mjs|cjs|js)$/;
const MESSAGE_LINES = 6;

const nodeCheck = (path) => spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true });

export function scriptSyntaxFailures(cwd, files, { check = nodeCheck } = {}) {
  const failures = [];
  for (const [file, entry] of files) {
    if (!SCRIPT.test(file) || entry?.text == null) continue;
    const r = check(join(cwd, file));
    if (r.status === 0) continue;
    const message = String(r.stderr || '').trim().split('\n').slice(0, MESSAGE_LINES).join('\n');
    failures.push({ file, cmd: `node --check ${file}`, exit: r.status ?? 1, message });
  }
  return failures;
}
